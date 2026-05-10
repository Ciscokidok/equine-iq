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
process.env.ENCRYPTION_KEY ??= '0'.repeat(64)

function makeToken(userId: string) {
  return jwt.sign({ sub: userId, email: 'test@test.com', plan: 'free' }, process.env.SECRET_KEY!)
}

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

describeIf('Provider Settings endpoints', () => {
  let userId: string
  let token: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `prov-test-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    userId = user.id
    token = makeToken(userId)
  })

  afterAll(async () => {
    await prisma.userProviderConfig.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { email: { contains: 'prov-test-' } } })
    await prisma.$disconnect()
  })

  it('POST saves credential and GET returns masked value', async () => {
    const plaintext = 'my-secret-api-key-12345678'
    await request(app)
      .post('/api/settings/providers/sporthorse_data')
      .set('Authorization', `Bearer ${token}`)
      .send({ credential: plaintext })
      .expect(200)

    const getRes = await request(app)
      .get('/api/settings/providers')
      .set('Authorization', `Bearer ${token}`)
    expect(getRes.status).toBe(200)
    const prov = getRes.body.providers.find((p: any) => p.provider === 'sporthorse_data' && !p.platform)
    expect(prov).toBeDefined()
    expect(prov.maskedCredential).not.toBe(plaintext)
    expect(prov.maskedCredential).toMatch(/••/)

    const dbRow = await prisma.userProviderConfig.findUnique({
      where: { userId_provider: { userId, provider: 'sporthorse_data' } },
    })
    expect(dbRow?.encryptedCredential).not.toBe(plaintext)
  })

  it('DELETE removes config', async () => {
    await request(app)
      .delete('/api/settings/providers/sporthorse_data')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const getRes = await request(app)
      .get('/api/settings/providers')
      .set('Authorization', `Bearer ${token}`)
    const prov = getRes.body.providers.find((p: any) => p.provider === 'sporthorse_data' && !p.platform)
    expect(prov).toBeUndefined()
  })

  it('returns 400 for invalid provider', async () => {
    const res = await request(app)
      .post('/api/settings/providers/invalid_provider')
      .set('Authorization', `Bearer ${token}`)
      .send({ credential: 'test' })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/settings/providers')
    expect(res.status).toBe(401)
  })
})
