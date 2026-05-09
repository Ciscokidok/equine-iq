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
function makeToken(userId: string) {
  return jwt.sign({ sub: userId, email: 'test@test.com', plan: 'free' }, process.env.SECRET_KEY!)
}

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

const CSV_ROWS = [
  { 'Horse Name': 'ExecTest1', Sire: 'Sire1', Dam: 'Dam1', 'Hip No.': '1', Price: '5000', 'Sale Date': '2024-03-15' },
]
const MAPPING = { horseName: 'Horse Name', sire: 'Sire', dam: 'Dam', hipNumber: 'Hip No.', hammerPrice: 'Price', saleDate: 'Sale Date' }

describeIf('POST /api/import/execute', () => {
  let userAId: string, userAToken: string
  let userBId: string, userBToken: string

  beforeAll(async () => {
    const ts = Date.now()
    const userA = await prisma.user.create({ data: { email: `exec-a-${ts}@test.com`, passwordHash: 'hashed', role: 'user' } })
    const userB = await prisma.user.create({ data: { email: `exec-b-${ts}@test.com`, passwordHash: 'hashed', role: 'user' } })
    userAId = userA.id; userAToken = makeToken(userAId)
    userBId = userB.id; userBToken = makeToken(userBId)
  })

  afterAll(async () => {
    await prisma.saleRecord.deleteMany({ where: { horse: { createdByUser: { in: [userAId, userBId] } } } })
    await prisma.importBatch.deleteMany({ where: { importedByUserId: { in: [userAId, userBId] } } })
    await prisma.horse.deleteMany({ where: { createdByUser: { in: [userAId, userBId] } } })
    await prisma.user.deleteMany({ where: { email: { contains: 'exec-a-' } } })
    await prisma.user.deleteMany({ where: { email: { contains: 'exec-b-' } } })
    await prisma.$disconnect()
  })

  it('returns 200 with import summary and persists ImportBatch', async () => {
    const res = await request(app)
      .post('/api/import/execute')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ mappingConfig: MAPPING, rows: CSV_ROWS, ownership: 'personal' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'completed')
    expect(res.body).toHaveProperty('createdCount')
    expect(res.body).toHaveProperty('matchedCount')
    expect(res.body).toHaveProperty('errorCount')
    const batch = await prisma.importBatch.findUnique({ where: { id: res.body.id } })
    expect(batch).not.toBeNull()
    expect(batch?.status).toBe('completed')
  })

  it('GET /api/import/history returns only calling user batches', async () => {
    await request(app)
      .post('/api/import/execute')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ mappingConfig: MAPPING, rows: CSV_ROWS, ownership: 'personal' })
    const res = await request(app)
      .get('/api/import/history')
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(res.body.batches.every((b: any) => b.importedByUserId === userAId)).toBe(true)
  })

  it('GET /api/import/history returns empty array when no batches', async () => {
    const ts = Date.now()
    const newUser = await prisma.user.create({ data: { email: `empty-hist-${ts}@test.com`, passwordHash: 'h', role: 'user' } })
    const token = makeToken(newUser.id)
    const res = await request(app).get('/api/import/history').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.batches).toEqual([])
    await prisma.user.delete({ where: { id: newUser.id } })
  })

  it('GET /api/import/history/:batchId returns 404 for another user batch', async () => {
    const batchRes = await request(app)
      .post('/api/import/execute')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ mappingConfig: MAPPING, rows: CSV_ROWS, ownership: 'personal' })
    const batchId = batchRes.body.id
    const res = await request(app)
      .get(`/api/import/history/${batchId}`)
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(404)
  })

  it('GET /api/import/history/:batchId returns batch with errorLog for owner', async () => {
    const batchRes = await request(app)
      .post('/api/import/execute')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ mappingConfig: MAPPING, rows: CSV_ROWS, ownership: 'personal' })
    const batchId = batchRes.body.id
    const res = await request(app)
      .get(`/api/import/history/${batchId}`)
      .set('Authorization', `Bearer ${userAToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('errorLog')
  })
})
