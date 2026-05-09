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

const CSV_FIXTURE = `Horse Name,Sire,Dam,Hip No.,Price\nSecretariat,Bold Ruler,Somethingroyal,1,5000\nCitation,Bull Lea,Hydroplane,2,3000`

describeIf('POST /api/import/upload', () => {
  let userId: string
  let token: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `import-test-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    userId = user.id
    token = makeToken(userId)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'import-test-' } } })
    await prisma.$disconnect()
  })

  it('returns 200 with headers, preview, and totalRows for valid CSV', async () => {
    const res = await request(app)
      .post('/api/import/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(CSV_FIXTURE), { filename: 'test.csv', contentType: 'text/csv' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('headers')
    expect(res.body).toHaveProperty('preview')
    expect(res.body).toHaveProperty('totalRows', 2)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/import/upload')
      .attach('file', Buffer.from(CSV_FIXTURE), { filename: 'test.csv', contentType: 'text/csv' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for non-CSV file', async () => {
    const res = await request(app)
      .post('/api/import/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), { filename: 'test.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('CSV')
  })

  it('returns 400 when no file provided', async () => {
    const res = await request(app)
      .post('/api/import/upload')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})

describeIf('POST /api/import/preview', () => {
  let token: string
  let userId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `preview-test-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    userId = user.id
    token = makeToken(userId)
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'preview-test-' } } })
    await prisma.$disconnect()
  })

  it('returns error rows when horseName is not mapped', async () => {
    const rows = [{ 'Horse Name': 'Secretariat', Sire: 'Bold Ruler' }]
    const res = await request(app)
      .post('/api/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ mappingConfig: { sire: 'Sire' }, rows })
    expect(res.status).toBe(200)
    expect(res.body.errorCount).toBeGreaterThan(0)
  })

  it('returns valid rows when horseName is mapped', async () => {
    const rows = [{ 'Horse Name': 'Secretariat', Sire: 'Bold Ruler', Dam: 'Somethingroyal' }]
    const res = await request(app)
      .post('/api/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ mappingConfig: { horseName: 'Horse Name', sire: 'Sire', dam: 'Dam' }, rows })
    expect(res.status).toBe(200)
    expect(res.body.validCount + res.body.matchedCount).toBeGreaterThan(0)
  })

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ invalid: true })
    expect(res.status).toBe(400)
  })
})
