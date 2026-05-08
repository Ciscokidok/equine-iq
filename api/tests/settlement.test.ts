import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../src/index'
import { prisma } from '../src/lib/prisma'
import { sendInvoiceEmail } from '../src/lib/auctionNotifications'

vi.mock('../src/lib/auctionSocket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  initSocket: vi.fn(),
}))

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

function makeAdminToken(userId: string): string {
  const secret = process.env.SECRET_KEY ?? 'test-secret'
  return jwt.sign({ sub: userId, email: 'admin@test.com', plan: 'free', role: 'admin' }, secret, { expiresIn: '1h' })
}

function makeUserToken(userId: string): string {
  const secret = process.env.SECRET_KEY ?? 'test-secret'
  return jwt.sign({ sub: userId, email: 'user@test.com', plan: 'free', role: 'user' }, secret, { expiresIn: '1h' })
}

// Test 1 — invoice math (no DB needed)
describe('Invoice calculation', () => {
  it('computes integer premiumAmount with no floating-point error', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.NODE_ENV = 'test'
    await sendInvoiceEmail({
      winnerEmail: 'winner@test.com',
      horseName: 'Test Horse',
      hammerPrice: 50001,
      buyersPremiumPct: 10,
      auctionId: 'test-id',
    })
    const call = consoleSpy.mock.calls.find(c => c[0] === '[invoice]')
    expect(call).toBeDefined()
    const { premiumAmount, totalDue } = call![1] as { premiumAmount: number; totalDue: number }
    expect(Number.isInteger(premiumAmount)).toBe(true)
    expect(Number.isInteger(totalDue)).toBe(true)
    expect(totalDue).toBe(50001 + premiumAmount)
    consoleSpy.mockRestore()
  })
})

describeIf('Settlement routes', () => {
  let adminId: string
  let userId: string
  let listingId: string
  let auctionId: string
  let bidder1Id: string
  let bidder2Id: string

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: { email: `settle-admin-${Date.now()}@test.com`, passwordHash: 'hashed', role: 'admin' },
    })
    adminId = admin.id

    const seller = await prisma.user.create({
      data: { email: `settle-seller-${Date.now()}@test.com`, passwordHash: 'hashed' },
    })

    bidder1Id = (await prisma.user.create({
      data: { email: `settle-b1-${Date.now()}@test.com`, passwordHash: 'hashed' },
    })).id

    bidder2Id = (await prisma.user.create({
      data: { email: `settle-b2-${Date.now()}@test.com`, passwordHash: 'hashed' },
    })).id

    userId = (await prisma.user.create({
      data: { email: `settle-user-${Date.now()}@test.com`, passwordHash: 'hashed' },
    })).id

    const horse = await prisma.horse.create({
      data: { name: 'Settlement Horse', breed: 'Thoroughbred', sex: 'stallion', createdByUser: seller.id },
    })

    const listing = await prisma.auctionListing.create({
      data: { horseId: horse.id, sellerId: seller.id, status: 'sold' },
    })
    listingId = listing.id

    const auction = await prisma.auction.create({
      data: {
        listingId,
        status: 'sold',
        startAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() - 60_000),
        startingBid: 10_000,
        currentBid: 50_000,
        bidIncrement: 1_000,
        auctionSource: 'internal',
        highBidderId: bidder1Id,
      },
    })
    auctionId = auction.id

    // bidder1 is high bidder, bidder2 is second
    await prisma.bid.create({ data: { auctionId, userId: bidder1Id, amount: 50_000 } })
    await prisma.bid.create({ data: { auctionId, userId: bidder2Id, amount: 45_000 } })
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { auctionId } })
    await prisma.auction.deleteMany({ where: { id: auctionId } })
    await prisma.auctionListing.deleteMany({ where: { id: listingId } })
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId, bidder1Id, bidder2Id] } } })
    await prisma.$disconnect()
  })

  it('confirm-payment sets paymentConfirmedAt', async () => {
    const res = await request(app)
      .post(`/api/auctions/${auctionId}/confirm-payment`)
      .set('Authorization', `Bearer ${makeAdminToken(adminId)}`)

    expect(res.status).toBe(200)
    expect(res.body.paymentConfirmedAt).toBeTruthy()

    const updated = await prisma.auction.findUnique({ where: { id: auctionId } })
    expect(updated!.paymentConfirmedAt).not.toBeNull()
  })

  it('offer-next-bidder updates highBidderId to second-highest bidder', async () => {
    const res = await request(app)
      .post(`/api/auctions/${auctionId}/offer-next-bidder`)
      .set('Authorization', `Bearer ${makeAdminToken(adminId)}`)

    expect(res.status).toBe(200)
    expect(res.body.offeredBidderId).toBe(bidder2Id)

    const updated = await prisma.auction.findUnique({ where: { id: auctionId } })
    expect(updated!.highBidderId).toBe(bidder2Id)
  })

  it('non-admin JWT gets 403 on confirm-payment', async () => {
    const res = await request(app)
      .post(`/api/auctions/${auctionId}/confirm-payment`)
      .set('Authorization', `Bearer ${makeUserToken(userId)}`)

    expect(res.status).toBe(403)
  })
})
