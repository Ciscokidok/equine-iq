/**
 * Integration tests for auction lifecycle cron tick and reserve behaviors.
 * Requires DATABASE_URL and SECRET_KEY env vars.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/lib/prisma'
import { cronTick } from '../src/lib/auctionLifecycle'

vi.mock('../src/lib/auctionSocket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  initSocket: vi.fn(),
}))

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

describeIf('Auction Lifecycle', () => {
  let sellerId: string
  let listingId: string

  beforeAll(async () => {
    const seller = await prisma.user.create({
      data: { email: `lifecycle-${Date.now()}@test.com`, password: 'hashed', name: 'Lifecycle Seller', role: 'user' },
    })
    sellerId = seller.id

    const horse = await prisma.horse.create({
      data: { name: 'Lifecycle Horse', breed: 'Thoroughbred', sex: 'stallion', createdByUser: sellerId },
    })

    const listing = await prisma.auctionListing.create({
      data: { horseId: horse.id, sellerId, status: 'approved' },
    })
    listingId = listing.id
  })

  afterAll(async () => {
    await prisma.auction.deleteMany({ where: { listingId } })
    await prisma.auctionListing.deleteMany({ where: { id: listingId } })
    await prisma.horse.deleteMany({ where: { createdByUser: sellerId } })
    await prisma.user.deleteMany({ where: { id: sellerId } })
    await prisma.$disconnect()
  })

  // Test 1: scheduled auction with past startAt → cronTick → status = 'open'
  it('transitions scheduled auction with past startAt to open', async () => {
    const auction = await prisma.auction.create({
      data: {
        listingId,
        status: 'scheduled',
        startAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
        startingBid: 100_000,
        currentBid: 0,
        bidIncrement: 5_000,
        auctionSource: 'internal',
      },
    })

    await cronTick()

    const updated = await prisma.auction.findUnique({ where: { id: auction.id } })
    expect(updated!.status).toBe('open')

    await prisma.auction.update({ where: { id: auction.id }, data: { status: 'scheduled', startAt: new Date(Date.now() - 60_000) } })
  })

  // Test 2: cronTick called again on same auction → still 'open' (idempotent)
  it('does not double-transition already-open auction (idempotent)', async () => {
    const auction = await prisma.auction.findFirst({ where: { listingId } })
    await prisma.auction.update({ where: { id: auction!.id }, data: { status: 'open' } })

    await cronTick()

    const updated = await prisma.auction.findUnique({ where: { id: auction!.id } })
    expect(updated!.status).toBe('open')
  })

  // Test 3: open auction with past endsAt + bid above reserve → cronTick → sold
  it('transitions to sold when high bid meets reserve on close', async () => {
    await prisma.auctionListing.update({
      where: { id: listingId },
      data: { reservePrice: 50_000, reserveBehavior: 'seller_decision' },
    })
    const auction = await prisma.auction.findFirst({ where: { listingId } })
    await prisma.auction.update({
      where: { id: auction!.id },
      data: { status: 'open', endsAt: new Date(Date.now() - 60_000), currentBid: 75_000 },
    })

    await cronTick()

    const updated = await prisma.auction.findUnique({ where: { id: auction!.id } })
    expect(updated!.status).toBe('sold')
  })

  // Test 4: bid below reserve, auto_pass → passed
  it('transitions to passed when bid below reserve with auto_pass behavior', async () => {
    await prisma.auctionListing.update({
      where: { id: listingId },
      data: { reservePrice: 200_000, reserveBehavior: 'auto_pass', status: 'approved' },
    })
    const prevAuction = await prisma.auction.findFirst({ where: { listingId } })
    await prisma.auction.delete({ where: { id: prevAuction!.id } })

    const auction = await prisma.auction.create({
      data: {
        listingId,
        status: 'open',
        startAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() - 60_000),
        startingBid: 50_000,
        currentBid: 80_000,
        bidIncrement: 5_000,
        auctionSource: 'internal',
      },
    })

    await cronTick()

    const updated = await prisma.auction.findUnique({ where: { id: auction.id } })
    expect(updated!.status).toBe('passed')
  })

  // Test 5: bid below reserve, seller_decision → seller_deciding, deadline set
  it('transitions to seller_deciding with deadline when bid below reserve with seller_decision behavior', async () => {
    await prisma.auctionListing.update({
      where: { id: listingId },
      data: { reservePrice: 200_000, reserveBehavior: 'seller_decision', status: 'approved' },
    })
    const prevAuction = await prisma.auction.findFirst({ where: { listingId } })
    if (prevAuction) await prisma.auction.delete({ where: { id: prevAuction.id } })

    const auction = await prisma.auction.create({
      data: {
        listingId,
        status: 'open',
        startAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() - 60_000),
        startingBid: 50_000,
        currentBid: 80_000,
        bidIncrement: 5_000,
        auctionSource: 'internal',
      },
    })

    await cronTick()

    const updated = await prisma.auction.findUnique({ where: { id: auction.id } })
    expect(updated!.status).toBe('seller_deciding')
    expect(updated!.sellerDecisionDeadline).not.toBeNull()
    const deadline = updated!.sellerDecisionDeadline!
    const diff = deadline.getTime() - Date.now()
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000)
  })

  // Test 6: POST /api/admin/cron/tick with invalid token → 401
  it('returns 401 for cron tick with invalid admin token', async () => {
    const res = await request(app)
      .post('/api/admin/cron/tick')
      .set('Authorization', 'Bearer wrong-token')

    expect(res.status).toBe(401)
  })
})
