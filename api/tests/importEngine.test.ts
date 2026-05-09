import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../src/lib/auctionSocket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
  initSocket: vi.fn(),
  broadcastBidUpdate: vi.fn(),
  broadcastStatusChange: vi.fn(),
}))

import { prisma } from '../src/lib/prisma'
import { executeImport } from '../src/lib/importEngine'
import type { ValidatedRow } from '../src/lib/csvParser'

process.env.SECRET_KEY ??= 'test-secret'

const hasDB = !!process.env.DATABASE_URL
const describeIf = hasDB ? describe : describe.skip

function makeValidRow(overrides: Partial<ValidatedRow> = {}): ValidatedRow {
  return {
    horseName: 'Secretariat',
    sex: 'stallion',
    breed: 'Thoroughbred',
    sire: 'Bold Ruler',
    dam: 'Somethingroyal',
    saleDate: '2024-03-15',
    hipNumber: '1',
    hammerPrice: '50000',
    _status: 'valid',
    _errors: [],
    _ignored: {},
    ...overrides,
  } as ValidatedRow
}

describeIf('executeImport', () => {
  let userId: string
  let batchId: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: { email: `engine-test-${ts}@test.com`, passwordHash: 'hashed', role: 'user' },
    })
    userId = user.id
    const batch = await prisma.importBatch.create({
      data: {
        importedByUserId: userId,
        source: 'csv',
        totalRows: 0,
      },
    })
    batchId = batch.id
  })

  afterAll(async () => {
    await prisma.saleRecord.deleteMany({ where: { importBatchId: batchId } })
    await prisma.importBatch.delete({ where: { id: batchId } }).catch(() => {})
    await prisma.horse.deleteMany({ where: { createdByUser: userId } })
    await prisma.user.deleteMany({ where: { email: { contains: 'engine-test-' } } })
    await prisma.$disconnect()
  })

  it('creates Horse and SaleRecord for 3 new rows', async () => {
    const ts = Date.now()
    const rows = [
      makeValidRow({ horseName: `ENG-${ts}-A`, hipNumber: '1' }),
      makeValidRow({ horseName: `ENG-${ts}-B`, hipNumber: '2' }),
      makeValidRow({ horseName: `ENG-${ts}-C`, hipNumber: '3' }),
    ]
    const result = await executeImport(rows, 'personal', batchId, userId)
    expect(result.createdCount).toBe(3)
    expect(result.matchedCount).toBe(0)
    expect(result.errorCount).toBe(0)
  })

  it('matches existing horse, no new Horse created', async () => {
    const horseName = `MATCH-${Date.now()}`
    await prisma.horse.create({
      data: {
        name: horseName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sex: 'stallion' as any,
        breed: 'Thoroughbred',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        discipline: 'thoroughbred_racing' as any,
        createdByUser: userId,
      },
    })
    const rows = [makeValidRow({ horseName, hipNumber: `H-${Date.now()}` })]
    const result = await executeImport(rows, 'personal', batchId, userId)
    expect(result.matchedCount).toBe(1)
    expect(result.createdCount).toBe(0)
  })

  it('second run of same batch produces 0 new records (idempotency)', async () => {
    const horseName = `IDEM-${Date.now()}`
    const hipNumber = `HIP-${Date.now()}`
    const saleDate = '2024-06-01'
    const rows = [makeValidRow({ horseName, hipNumber, saleDate })]

    const first = await executeImport(rows, 'personal', batchId, userId)
    const before = await prisma.saleRecord.count({ where: { importBatchId: batchId } })
    const second = await executeImport(rows, 'personal', batchId, userId)
    const after = await prisma.saleRecord.count({ where: { importBatchId: batchId } })

    expect(first.createdCount).toBe(1)
    expect(second.createdCount).toBe(0)
    expect(after).toBe(before)
  })

  it('isolates error row — other rows still succeed', async () => {
    const ts = Date.now()
    const errorRow = {
      ...makeValidRow({ horseName: `ERR-${ts}` }),
      _status: 'error' as const,
      _errors: ['Missing: Horse Name'],
    }
    const goodRow = makeValidRow({ horseName: `GOOD-${ts}`, hipNumber: `G-${ts}` })
    const result = await executeImport([errorRow, goodRow], 'personal', batchId, userId)
    expect(result.errorCount).toBe(1)
    expect(result.createdCount).toBe(1)
  })

  it('personal ownership sets createdByUser = userId', async () => {
    const horseName = `PERSONAL-${Date.now()}`
    await executeImport([makeValidRow({ horseName, hipNumber: `P-${Date.now()}` })], 'personal', batchId, userId)
    const horse = await prisma.horse.findFirst({ where: { name: horseName } })
    expect(horse?.createdByUser).toBe(userId)
  })

  it('shared ownership sets createdByUser = null', async () => {
    const horseName = `SHARED-${Date.now()}`
    await executeImport([makeValidRow({ horseName, hipNumber: `S-${Date.now()}` })], 'shared', batchId, userId)
    const horse = await prisma.horse.findFirst({ where: { name: horseName } })
    expect(horse?.createdByUser).toBeNull()
  })
})
