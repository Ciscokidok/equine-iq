/**
 * Integration tests for auction catalog and detail routes.
 * Requires DATABASE_URL env var. S3 is mocked.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'

vi.mock('../src/lib/auctionSocket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  initSocket: vi.fn(),
  broadcastBidUpdate: vi.fn(),
  broadcastStatusChange: vi.fn(),
}))

vi.mock('../src/lib/s3Upload', () => ({
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://s3.example.com/test-doc.pdf'),
  getPresignedUploadUrl: vi.fn().mockResolvedValue({ uploadUrl: 'https://s3.example.com/upload', s3Key: 'test-key' }),
}))

import { app } from '../src/index'
import { prisma } from '../src/lib/prisma'

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

describeIf('Auction Catalog', () => {
  let sellerId: string
  let openAuctionId: string
  let scheduledAuctionId: string
  let soldAuctionId: string
  let pendingAuctionId: string
  let openListingId: string

  const horseIds: string[] = []
  const listingIds: string[] = []
  const auctionIds: string[] = []

  beforeAll(async () => {
    const ts = Date.now()
    const seller = await prisma.user.create({
      data: { email: `catalog-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    sellerId = seller.id

    const horse1 = await prisma.horse.create({
      data: {
        name: 'Cat Thoroughbred', breed: 'Thoroughbred', sex: 'stallion', discipline: 'flat_racing',
        pedigree: { sire: 'Sire A', dam: 'Dam A' }, conformationNotes: 'Excellent conformation',
        createdByUser: sellerId,
      },
    })
    const horse2 = await prisma.horse.create({
      data: { name: 'Cat Warmblood', breed: 'Warmblood', sex: 'mare', discipline: 'dressage', createdByUser: sellerId },
    })
    const horse3 = await prisma.horse.create({
      data: { name: 'Cat Sold TB', breed: 'Thoroughbred', sex: 'gelding', discipline: 'flat_racing', createdByUser: sellerId },
    })
    const horse4 = await prisma.horse.create({
      data: { name: 'Cat Pending', breed: 'Quarter Horse', sex: 'mare', discipline: 'reining', createdByUser: sellerId },
    })
    horseIds.push(horse1.id, horse2.id, horse3.id, horse4.id)

    const listing1 = await prisma.auctionListing.create({ data: { horseId: horse1.id, sellerId, status: 'open' } })
    const listing2 = await prisma.auctionListing.create({ data: { horseId: horse2.id, sellerId, status: 'scheduled' } })
    const listing3 = await prisma.auctionListing.create({ data: { horseId: horse3.id, sellerId, status: 'sold' } })
    const listing4 = await prisma.auctionListing.create({ data: { horseId: horse4.id, sellerId, status: 'pending_review' } })
    listingIds.push(listing1.id, listing2.id, listing3.id, listing4.id)
    openListingId = listing1.id

    const now = Date.now()
    const aOpen = await prisma.auction.create({
      data: { listingId: listing1.id, status: 'open', startAt: new Date(now - 3_600_000), endsAt: new Date(now + 3_600_000), startingBid: 100_000, currentBid: 0, bidIncrement: 5_000, auctionSource: 'internal' },
    })
    const aSched = await prisma.auction.create({
      data: { listingId: listing2.id, status: 'scheduled', startAt: new Date(now + 7_200_000), endsAt: new Date(now + 14_400_000), startingBid: 80_000, currentBid: 0, bidIncrement: 5_000, auctionSource: 'internal' },
    })
    const aSold = await prisma.auction.create({
      data: { listingId: listing3.id, status: 'sold', startAt: new Date(now - 7_200_000), endsAt: new Date(now - 3_600_000), startingBid: 50_000, currentBid: 120_000, bidIncrement: 5_000, auctionSource: 'internal' },
    })
    const aPending = await prisma.auction.create({
      data: { listingId: listing4.id, status: 'pending_review', startAt: new Date(now + 3_600_000), endsAt: new Date(now + 7_200_000), startingBid: 50_000, currentBid: 0, bidIncrement: 5_000, auctionSource: 'internal' },
    })
    auctionIds.push(aOpen.id, aSched.id, aSold.id, aPending.id)
    openAuctionId = aOpen.id
    scheduledAuctionId = aSched.id
    soldAuctionId = aSold.id
    pendingAuctionId = aPending.id
  })

  afterAll(async () => {
    await prisma.bid.deleteMany({ where: { auctionId: { in: auctionIds } } })
    await prisma.vettingDocument.deleteMany({ where: { listingId: { in: listingIds } } })
    await prisma.auction.deleteMany({ where: { id: { in: auctionIds } } })
    await prisma.auctionListing.deleteMany({ where: { id: { in: listingIds } } })
    await prisma.horse.deleteMany({ where: { id: { in: horseIds } } })
    await prisma.user.deleteMany({ where: { id: sellerId } })
    await prisma.$disconnect()
  })

  it('catalog returns scheduled and open auctions only (not sold)', async () => {
    const res = await request(app).get('/api/auctions/catalog')
    expect(res.status).toBe(200)
    const ids = res.body.map((a: any) => a.id)
    expect(ids).toContain(openAuctionId)
    expect(ids).toContain(scheduledAuctionId)
    expect(ids).not.toContain(soldAuctionId)
  })

  it('breed filter narrows catalog results', async () => {
    const res = await request(app).get('/api/auctions/catalog?breed=Thoroughbred')
    expect(res.status).toBe(200)
    const ids = res.body.map((a: any) => a.id)
    expect(ids).toContain(openAuctionId)
    expect(ids).not.toContain(scheduledAuctionId)
  })

  it('returns 400 for invalid discipline query param', async () => {
    const res = await request(app).get('/api/auctions/catalog?discipline=badvalue')
    expect(res.status).toBe(400)
  })

  it('detail route returns horse pedigree and conformationNotes', async () => {
    const res = await request(app).get(`/api/auctions/${openAuctionId}`)
    expect(res.status).toBe(200)
    expect(res.body.horse?.pedigree).toBeDefined()
    expect(res.body.horse?.conformationNotes).toBe('Excellent conformation')
  })

  it('detail route returns documents array with presigned downloadUrl', async () => {
    const doc = await prisma.vettingDocument.create({
      data: { listingId: openListingId, docType: 'coggins_test', fileName: 'coggins.pdf', s3Key: 'listings/test/coggins.pdf', mimeType: 'application/pdf', scanStatus: 'clean' },
    })
    const res = await request(app).get(`/api/auctions/${openAuctionId}`)
    expect(res.status).toBe(200)
    expect(res.body.documents).toHaveLength(1)
    expect(res.body.documents[0].downloadUrl).toBe('https://s3.example.com/test-doc.pdf')
    await prisma.vettingDocument.delete({ where: { id: doc.id } })
  })

  it('returns 404 for pending_review auction', async () => {
    const res = await request(app).get(`/api/auctions/${pendingAuctionId}`)
    expect(res.status).toBe(404)
  })
})
