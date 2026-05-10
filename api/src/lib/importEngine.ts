import { prisma } from './prisma'
import type { ValidatedRow } from './csvParser'

export interface PedigreeSuggestion {
  importedHorseId: string
  field: 'sire' | 'dam'
  matchedHorseId: string
  matchedHorseName: string
}

export interface ImportResult {
  createdCount: number
  matchedCount: number
  errorCount: number
  errorLog: Array<{ rowIndex: number; error: string }>
  pedigreeSuggestions: PedigreeSuggestion[]
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
  const createdHorses: Array<{ id: string; sire?: string; dam?: string }> = []

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
        const newHorse = await prisma.$transaction(async (tx) => {
          const h = await tx.horse.create({
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
              horseId: h.id,
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
          return h
        })
        createdHorses.push({ id: newHorse.id, sire: row.sire, dam: row.dam })
        createdCount++
      }
    } catch (e: unknown) {
      errorCount++
      errorLog.push({ rowIndex: i, error: e instanceof Error ? e.message : String(e) })
    }
  }

  const pedigreeSuggestions: PedigreeSuggestion[] = []
  if (createdHorses.length > 0) {
    const sireNames = createdHorses.filter((h) => h.sire).map((h) => h.sire!)
    const damNames = createdHorses.filter((h) => h.dam).map((h) => h.dam!)
    const allNames = [...new Set([...sireNames, ...damNames])]
    if (allNames.length > 0) {
      const matches = await prisma.horse.findMany({ where: { name: { in: allNames } } })
      for (const created of createdHorses) {
        if (created.sire) {
          const match = matches.find((m) => m.name === created.sire)
          if (match) pedigreeSuggestions.push({ importedHorseId: created.id, field: 'sire', matchedHorseId: match.id, matchedHorseName: match.name })
        }
        if (created.dam) {
          const match = matches.find((m) => m.name === created.dam)
          if (match) pedigreeSuggestions.push({ importedHorseId: created.id, field: 'dam', matchedHorseId: match.id, matchedHorseName: match.name })
        }
      }
    }
  }

  return { createdCount, matchedCount, errorCount, errorLog, pedigreeSuggestions }
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
