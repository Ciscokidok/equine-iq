/**
 * Integration tests for bid placement: approval gate, minimum bid, increment, closed auction.
 * Requires DATABASE_URL and SECRET_KEY env vars.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../src/lib/auctionSocket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  initSocket: vi.fn(),
  broadcastBidUpdate: vi.fn(),
  broadcastStatusChange: vi.fn(),
}))

import { app } from '../src/index'
import { prisma } from '../src/lib/prisma'

process.env.SECRET_KEY ??= 'test-secret'

function makeToken(userId: string): string {
  return jwt.sign({ sub: userId, email: 'test@test.com', plan: 'free' }, process.env.SECRET_KEY!)
}

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

describeIf('Bidding', () => {
  let sellerId: string
  let approvedBidderId: string
  let unapprovedBidderId: string
  let horseId: string
  let listingId: string
  let auctionId: string

  beforeAll(async () => {
    const ts = Date.now()
    const seller = await prisma.user.create({
      data: { email: `bid-seller-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    sellerId = seller.id

    const approvedBidder = await prisma.user.create({
      data: { email: `bid-approved-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    approvedBidderId = approvedBidder.id

    const unapprovedBidder = await prisma.user.create({
      data: { email: `bid-unapproved-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    unapprovedBidderId = unapprovedBidder.id

    await prisma.bidderApproval.create({
      data: { userId: approvedBidderId, status: 'approved', approvedAt: new Date() },
    })

    const horse = await prisma.horse.create({
      data: { name: 'Bid Test Horse', breed: 'Thoroughbred', sex: 'stallion', discipline: 'flat_racing', createdByUser: sellerId },
    })
    horseId = horse.id

    const listing = await prisma.auctionListing.create({
      data: { horseId, sellerId, status: 'open' },
    })
    listingId = listing.id

    const auction = await prisma.auction.create({
      data: {
        listingId,
        status: 'open',
        startAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() + 3_600_000),
        startingBid: 100_000,
        currentBid: 0,
        bidIncrement: 5_000,
        auctionSource: 'internal',
      },
    })
    auctionId = auction.id
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { auctionId } })
    await prisma.auction.deleteMany({ where: { id: auctionId } })
    await prisma.bidderApproval.deleteMany({ where: { userId: approvedBidderId } })
    await prisma.auctionListing.deleteMany({ where: { id: listingId } })
    await prisma.horse.deleteMany({ where: { id: horseId } })
    await prisma.user.deleteMany({ where: { id: { in: [sellerId, approvedBidderId, unapprovedBidderId] } } })
    await prisma.$disconnect()
  })

  it('accepts first bid at or above starting bid', async () => {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'open', currentBid: 0, highBidderId: null } })
    await prisma.bid.deleteMany({ where: { auctionId } })

    const res = await request(app)
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${makeToken(approvedBidderId)}`)
      .send({ amount: 100_000 })

    expect(res.status).toBe(201)
    expect(res.body.currentBid).toBe(100_000)
  })

  it('rejects bid below starting bid (first bid below minimum)', async () => {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'open', currentBid: 0, highBidderId: null } })
    await prisma.bid.deleteMany({ where: { auctionId } })

    const res = await request(app)
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${makeToken(approvedBidderId)}`)
      .send({ amount: 50_000 })

    expect(res.status).toBe(400)
  })

  it('rejects bid that does not meet increment requirement', async () => {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'open', currentBid: 100_000, highBidderId: sellerId } })

    const res = await request(app)
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${makeToken(approvedBidderId)}`)
      .send({ amount: 104_000 })

    expect(res.status).toBe(400)
  })

  it('returns 403 when bidder has no approved bidder record', async () => {
    const res = await request(app)
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${makeToken(unapprovedBidderId)}`)
      .send({ amount: 200_000 })

    expect(res.status).toBe(403)
  })

  it('returns 400 when auction is not open', async () => {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'closed' } })

    const res = await request(app)
      .post(`/api/auctions/${auctionId}/bid`)
      .set('Authorization', `Bearer ${makeToken(approvedBidderId)}`)
      .send({ amount: 200_000 })

    expect(res.status).toBe(400)

    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'open' } })
  })
})
