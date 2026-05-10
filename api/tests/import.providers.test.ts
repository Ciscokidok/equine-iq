import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../src/lib/auctionSocket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  initSocket: vi.fn(),
  broadcastBidUpdate: vi.fn(),
  broadcastStatusChange: vi.fn(),
}))

vi.mock('../src/lib/dataProviders/registry', () => ({
  getAdapter: vi.fn(() => ({
    testConnection: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([{ name: 'MockHorse', providerRef: 'ref-1' }]),
    fetchSaleHistory: vi.fn().mockResolvedValue([]),
  })),
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

describeIf('Provider list and search endpoints', () => {
  let userId: string
  let token: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `prov-list-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    userId = user.id
    token = makeToken(userId)
  })

  afterAll(async () => {
    await prisma.userProviderConfig.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { email: { contains: 'prov-list-' } } })
    await prisma.$disconnect()
  })

  it('returns configured provider when credential exists', async () => {
    await prisma.userProviderConfig.create({
      data: { userId, provider: 'equibase', encryptedCredential: 'enc-test' },
    })
    const res = await request(app).get('/api/import/providers').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(res.body.providers.some((p: any) => p.provider === 'equibase' && p.configured)).toBe(true)
  })

  it('returns empty providers when no credentials', async () => {
    const ts = Date.now()
    const user2 = await prisma.user.create({
      data: { email: `prov-empty-${ts}@test.com`, passwordHash: 'h', role: 'user' },
    })
    const t2 = makeToken(user2.id)
    const res = await request(app).get('/api/import/providers').set('Authorization', `Bearer ${t2}`)
    expect(res.status).toBe(200)
    expect(res.body.providers).toEqual([])
    await prisma.user.delete({ where: { id: user2.id } })
  })

  it('returns 403 when searching without credentials', async () => {
    const ts = Date.now()
    const user3 = await prisma.user.create({
      data: { email: `prov-nocred-${ts}@test.com`, passwordHash: 'h', role: 'user' },
    })
    const t3 = makeToken(user3.id)
    const res = await request(app)
      .get('/api/import/providers/sporthorse_data/search?q=horse')
      .set('Authorization', `Bearer ${t3}`)
    expect(res.status).toBe(403)
    expect(res.body.error).toContain('Settings')
    await prisma.user.delete({ where: { id: user3.id } })
  })
})
