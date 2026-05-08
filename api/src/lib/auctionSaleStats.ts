import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface SaleStats {
  stallionId: string
  mareId: string | null
  count: number
  avg: number | null
  median: number | null
  high: number | null
  low: number | null
  lowSampleWarning: boolean
}

export interface BulkSaleStat {
  avg: number
  count: number
}

export async function getStallionSaleStats(
  stallionId: string,
  userId: string,
  mareId?: string,
): Promise<SaleStats> {
  const rows = await prisma.$queryRaw<
    [{ count: bigint; avg: number | null; median: number | null; min: number | null; max: number | null }]
  >`
    SELECT
      COUNT(*) as count,
      AVG(a."salePrice") as avg,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY a."salePrice") as median,
      MIN(a."salePrice") as min,
      MAX(a."salePrice") as max
    FROM "AuctionSale" a
    JOIN "Foal" f ON a."foalId" = f.id
    WHERE f."stallionId" = ${stallionId}
      AND a."userId" = ${userId}
      ${mareId ? Prisma.sql`AND f."mareId" = ${mareId}` : Prisma.empty}
  `

  const row = rows[0]
  const count = Number(row.count)

  if (count === 0) {
    return { stallionId, mareId: mareId ?? null, count: 0, avg: null, median: null, high: null, low: null, lowSampleWarning: false }
  }

  return {
    stallionId,
    mareId: mareId ?? null,
    count,
    avg: row.avg,
    median: row.median,
    high: row.max,
    low: row.min,
    lowSampleWarning: count < 3,
  }
}

export async function getBulkSaleStats(
  stallionIds: string[],
  userId: string,
): Promise<Map<string, BulkSaleStat>> {
  if (stallionIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<
    Array<{ stallionId: string; count: bigint; avg: number }>
  >`
    SELECT
      f."stallionId",
      COUNT(*) as count,
      AVG(a."salePrice") as avg
    FROM "AuctionSale" a
    JOIN "Foal" f ON a."foalId" = f.id
    WHERE f."stallionId" IN (${Prisma.join(stallionIds)})
      AND a."userId" = ${userId}
    GROUP BY f."stallionId"
  `

  const result = new Map<string, BulkSaleStat>()
  for (const row of rows) {
    result.set(row.stallionId, { avg: row.avg, count: Number(row.count) })
  }
  return result
}
