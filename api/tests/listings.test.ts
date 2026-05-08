/**
 * Integration tests for listing creation, document upload, vetting queue, approve/reject.
 * Requires DATABASE_URL and SECRET_KEY env vars to run against a real DB.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/lib/prisma'
import { createToken } from '../src/lib/auth'
import jwt from 'jsonwebtoken'

vi.mock('../src/lib/s3Upload', () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://s3.example.com/presigned',
    s3Key: 'listings/test/coggins_test/1234-test.pdf',
  }),
  getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://s3.example.com/download'),
}))

// Skip all tests if DATABASE_URL is not set — integration tests need a real DB
const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

describeIf('Listing & Vetting Flow', () => {
  let sellerAId: string
  let sellerBId: string
  let adminId: string
  let sellerAToken: string
  let sellerBToken: string
  let adminToken: string
  let horseAId: string
  let horseBId: string

  beforeAll(async () => {
    // Create two seller users and one admin user
    const sellerA = await prisma.user.create({
      data: { email: `seller-a-${Date.now()}@test.com`, password: 'hashed', name: 'Seller A', role: 'user' },
    })
    const sellerB = await prisma.user.create({
      data: { email: `seller-b-${Date.now()}@test.com`, password: 'hashed', name: 'Seller B', role: 'user' },
    })
    const admin = await prisma.user.create({
      data: { email: `admin-${Date.now()}@test.com`, password: 'hashed', name: 'Admin', role: 'admin' },
    })

    sellerAId = sellerA.id
    sellerBId = sellerB.id
    adminId = admin.id

    sellerAToken = createToken({ sub: sellerAId, email: sellerA.email, plan: 'pro' })
    sellerBToken = createToken({ sub: sellerBId, email: sellerB.email, plan: 'pro' })
    // Admin token includes role in payload so requireAdmin passes
    const secret = process.env.SECRET_KEY!
    adminToken = jwt.sign({ sub: adminId, email: admin.email, plan: 'pro', role: 'admin' }, secret, { algorithm: 'HS256', expiresIn: '1h' })

    // Create one horse owned by seller A, one by seller B
    const horseA = await prisma.horse.create({
      data: { name: 'Horse A', breed: 'Quarter Horse', sex: 'stallion', createdByUser: sellerAId },
    })
    const horseB = await prisma.horse.create({
      data: { name: 'Horse B', breed: 'Thoroughbred', sex: 'mare', createdByUser: sellerBId },
    })

    horseAId = horseA.id
    horseBId = horseB.id
  })

  afterAll(async () => {
    // Cleanup in dependency order
    await prisma.vettingDocument.deleteMany({ where: { listing: { sellerId: { in: [sellerAId, sellerBId] } } } })
    await prisma.auctionListing.deleteMany({ where: { sellerId: { in: [sellerAId, sellerBId] } } })
    await prisma.horse.deleteMany({ where: { id: { in: [horseAId, horseBId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [sellerAId, sellerBId, adminId] } } })
    await prisma.$disconnect()
  })

  // Test 1: Seller A cannot list Seller B's horse
  it('returns 404 when seller tries to list another user\'s horse', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseBId })

    expect(res.status).toBe(404)
  })

  // Test 2: Listing creation succeeds
  it('creates listing with status pending_review', async () => {
    const res = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending_review')
    expect(res.body.sellerId).toBe(sellerAId)
    expect(res.body.horseId).toBe(horseAId)
  })

  // Test 3: Listing with only coggins_test does NOT appear in vetting queue
  it('excludes listing from queue when only one required doc is present', async () => {
    // Create listing
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({ horseId: horseBId })
    expect(createRes.status).toBe(201)
    const listingId = createRes.body.id

    // Upload only coggins_test — missing vet_certificate and registration_papers
    await prisma.vettingDocument.create({
      data: { listingId, docType: 'coggins_test', s3Key: `listings/${listingId}/coggins_test/test.pdf`, fileName: 'coggins.pdf', mimeType: 'application/pdf', scanStatus: 'clean' },
    })

    const queueRes = await request(app)
      .get('/api/admin/vetting/queue')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(queueRes.status).toBe(200)
    const ids = queueRes.body.map((l: { id: string }) => l.id)
    expect(ids).not.toContain(listingId)
  })

  // Test 4: Listing with all 3 required docs appears in queue
  it('includes listing in queue when all 3 required docs are present', async () => {
    // Create listing
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })
    expect(createRes.status).toBe(201)
    const listingId = createRes.body.id

    // Upload all 3 required docs
    for (const docType of ['coggins_test', 'vet_certificate', 'registration_papers']) {
      await prisma.vettingDocument.create({
        data: { listingId, docType: docType as any, s3Key: `listings/${listingId}/${docType}/test.pdf`, fileName: `${docType}.pdf`, mimeType: 'application/pdf', scanStatus: 'clean' },
      })
    }

    const queueRes = await request(app)
      .get('/api/admin/vetting/queue')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(queueRes.status).toBe(200)
    const ids = queueRes.body.map((l: { id: string }) => l.id)
    expect(ids).toContain(listingId)
  })

  // Test 5: Approve transitions to approved; second approve is idempotent
  it('approves listing and second approve returns 200 (idempotent)', async () => {
    // Create listing and add required docs
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })
    const listingId = createRes.body.id

    for (const docType of ['coggins_test', 'vet_certificate', 'registration_papers']) {
      await prisma.vettingDocument.create({
        data: { listingId, docType: docType as any, s3Key: `listings/${listingId}/${docType}/test.pdf`, fileName: `${docType}.pdf`, mimeType: 'application/pdf', scanStatus: 'clean' },
      })
    }

    // First approve
    const approveRes1 = await request(app)
      .post(`/api/admin/vetting/${listingId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(approveRes1.status).toBe(200)
    expect(approveRes1.body.status).toBe('approved')

    // Second approve — idempotent
    const approveRes2 = await request(app)
      .post(`/api/admin/vetting/${listingId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(approveRes2.status).toBe(200)
    expect(approveRes2.body.status).toBe('approved')
  })

  // Test 6: Non-admin JWT on GET /queue returns 403
  it('returns 403 for non-admin user accessing vetting queue', async () => {
    const res = await request(app)
      .get('/api/admin/vetting/queue')
      .set('Authorization', `Bearer ${sellerAToken}`)

    expect(res.status).toBe(403)
  })

  // Test 7: Configure on approved listing → 200, status scheduled, Auction created
  it('configures auction on approved listing and transitions to scheduled', async () => {
    // Create and approve a listing
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })
    expect(createRes.status).toBe(201)
    const listingId = createRes.body.id

    await prisma.auctionListing.update({ where: { id: listingId }, data: { status: 'approved' } })

    const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const configRes = await request(app)
      .post(`/api/listings/${listingId}/configure`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ startAt, durationMinutes: 60, startingBid: 100000, bidIncrement: 5000 })

    expect(configRes.status).toBe(200)
    expect(configRes.body.status).toBe('scheduled')

    const auction = await prisma.auction.findFirst({ where: { listingId } })
    expect(auction).not.toBeNull()
    expect(auction!.status).toBe('scheduled')
  })

  // Test 8: Configure on pending_review listing → 400
  it('returns 400 when configuring a listing not in approved status', async () => {
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })
    expect(createRes.status).toBe(201)
    const listingId = createRes.body.id

    const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const configRes = await request(app)
      .post(`/api/listings/${listingId}/configure`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ startAt, durationMinutes: 60, startingBid: 100000, bidIncrement: 5000 })

    expect(configRes.status).toBe(400)
  })

  // Test 9: Upload URL — success path returns uploadUrl and documentId
  it('returns uploadUrl and documentId for valid document upload request', async () => {
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })
    expect(createRes.status).toBe(201)
    const listingId = createRes.body.id

    const uploadRes = await request(app)
      .post(`/api/listings/${listingId}/documents/upload-url`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ docType: 'coggins_test', fileName: 'coggins.pdf', mimeType: 'application/pdf' })

    expect(uploadRes.status).toBe(200)
    expect(uploadRes.body).toHaveProperty('uploadUrl')
    expect(uploadRes.body).toHaveProperty('documentId')
  })

  // Test 10: Upload URL — cross-user access returns 404
  it('returns 404 when seller B tries to upload to seller A\'s listing', async () => {
    const createRes = await request(app)
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ horseId: horseAId })
    expect(createRes.status).toBe(201)
    const listingId = createRes.body.id

    const uploadRes = await request(app)
      .post(`/api/listings/${listingId}/documents/upload-url`)
      .set('Authorization', `Bearer ${sellerBToken}`)
      .send({ docType: 'coggins_test', fileName: 'coggins.pdf', mimeType: 'application/pdf' })

    expect(uploadRes.status).toBe(404)
  })
})
