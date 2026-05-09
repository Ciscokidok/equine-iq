import { prisma } from './prisma'
import type { ValidatedRow } from './csvParser'

export interface ImportResult {
  createdCount: number
  matchedCount: number
  errorCount: number
  errorLog: Array<{ rowIndex: number; error: string }>
  pedigreeSuggestions: Array<unknown>
}

export async function executeImport(
  rows: ValidatedRow[],
  ownership: 'personal' | 'shared',
  batchId: string,
  userId: string,
  defaultDiscipline = 'other'
): Promise<ImportResult> {
  let createdCount = 0
  let matchedCount = 0
  let errorCount = 0
  const errorLog: ImportResult['errorLog'] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row._status !== 'valid') {
      errorCount++
      errorLog.push({ rowIndex: i, error: row._errors.join('; ') })
      continue
    }

    try {
      // Dedup: user-owned first, then shared catalog
      const existing = await prisma.horse.findFirst({
        where: {
          name: row.horseName!,
          OR: [{ createdByUser: userId }, { createdByUser: null }],
        },
      })

      const saleDate = row.saleDate ? new Date(row.saleDate) : new Date()
      const hammerPriceCents = row.hammerPrice ? normalizePrice(row.hammerPrice) : 0

      if (existing) {
        // Horse exists — upsert SaleRecord only
        await prisma.saleRecord.upsert({
          where: {
            horseId_hipNumber_saleDate: {
              horseId: existing.id,
              hipNumber: row.hipNumber ?? '',
              saleDate,
            },
          },
          update: {},
          create: {
            horseId: existing.id,
            importBatchId: batchId,
            saleSource: 'csv',
            saleSessionName: row.saleSessionName ?? null,
            saleDate,
            hipNumber: row.hipNumber ?? null,
            hammerPriceCents,
            buyerName: row.buyerName ?? null,
            consignorName: row.consignorName ?? null,
          },
        })
        matchedCount++
      } else {
        // Create Horse + SaleRecord atomically
        await prisma.$transaction(async (tx) => {
          const horse = await tx.horse.create({
            data: {
              name: row.horseName!,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sex: normalizeSex(row.sex) as any,
              breed: row.breed ?? 'unknown',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              discipline: (defaultDiscipline || 'other') as any,
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
              registrationNumber: row.registrationNumber ?? null,
              pedigree: {
                sire: row.sire ?? null,
                dam: row.dam ?? null,
                damsire: row.damsire ?? null,
              },
              createdByUser: ownership === 'shared' ? null : userId,
            },
          })
          await tx.saleRecord.create({
            data: {
              horseId: horse.id,
              importBatchId: batchId,
              saleSource: 'csv',
              saleSessionName: row.saleSessionName ?? null,
              saleDate,
              hipNumber: row.hipNumber ?? null,
              hammerPriceCents,
              buyerName: row.buyerName ?? null,
              consignorName: row.consignorName ?? null,
            },
          })
        })
        createdCount++
      }
    } catch (e: unknown) {
      errorCount++
      errorLog.push({ rowIndex: i, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return { createdCount, matchedCount, errorCount, errorLog, pedigreeSuggestions: [] }
}

function normalizePrice(raw: string): number {
  const cleaned = raw.replace(/[$£€,]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

// Sex enum: mare | stallion | gelding — no 'unknown'; default to 'mare' for unrecognized
function normalizeSex(raw?: string): string {
  if (!raw) return 'mare'
  const s = raw.toLowerCase()
  if (s === 'mare' || s === 'f' || s === 'female' || s === 'filly') return 'mare'
  if (s === 'stallion' || s === 'm' || s === 'male' || s === 'colt') return 'stallion'
  if (s === 'gelding' || s === 'g') return 'gelding'
  return 'mare'
}
