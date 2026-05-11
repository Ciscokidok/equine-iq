import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

// GET /api/analytics/valuation/stallions
// Returns stallions with stud fee vs progeny sale price comparison
router.get('/valuation/stallions', requireAuth, async (_req: Request, res: Response) => {
  type StallionRow = {
    id: string
    name: string
    studFee: number | null
    progeny_count: bigint
    avg_price: bigint
    median_price: bigint
    min_price: bigint
    max_price: bigint
  }

  const rows = await prisma.$queryRaw<StallionRow[]>`
    SELECT
      s.id,
      s.name,
      s."studFee",
      COUNT(sr.id)::int                                                          AS progeny_count,
      ROUND(AVG(sr."hammerPriceCents"))::bigint                                  AS avg_price,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sr."hammerPriceCents"))::bigint AS median_price,
      MIN(sr."hammerPriceCents")::bigint                                         AS min_price,
      MAX(sr."hammerPriceCents")::bigint                                         AS max_price
    FROM "Horse" s
    JOIN "Horse" o ON o.pedigree->>'sire' = s.name
    JOIN "SaleRecord" sr ON sr."horseId" = o.id
    WHERE s.sex = 'stallion'
      AND sr."hammerPriceCents" > 0
    GROUP BY s.id, s.name, s."studFee"
    HAVING COUNT(sr.id) >= 2
    ORDER BY s.name
  `

  const stallions = rows.map((r) => {
    const avgPrice = Number(r.avg_price)
    const studFee = r.studFee ?? null
    const ratio = studFee && avgPrice > 0 ? studFee / avgPrice : null
    return {
      id: r.id,
      name: r.name,
      studFee,
      progenyCount: Number(r.progeny_count),
      avgProgenyPrice: avgPrice,
      medianProgenyPrice: Number(r.median_price),
      minProgenyPrice: Number(r.min_price),
      maxProgenyPrice: Number(r.max_price),
      // ratio > 1 means stud fee > avg progeny sale = overvalued
      // ratio < 1 means stud fee < avg progeny sale = undervalued
      studFeeToAvgRatio: ratio,
    }
  })

  res.json({ stallions })
})

// GET /api/analytics/valuation/comparables
// Returns individual horses ranked against their sire-group average
router.get('/valuation/comparables', requireAuth, async (_req: Request, res: Response) => {
  type ComparableRow = {
    horse_id: string
    horse_name: string
    sire: string | null
    sale_id: string
    sale_price: bigint
    sale_date: Date
    sale_session: string | null
    sire_avg: bigint
    sire_median: bigint
    sire_count: bigint
    ratio: number
  }

  const rows = await prisma.$queryRaw<ComparableRow[]>`
    WITH sire_stats AS (
      SELECT
        o.pedigree->>'sire'                                                              AS sire_name,
        COUNT(sr.id)::int                                                                AS sire_count,
        ROUND(AVG(sr."hammerPriceCents"))::bigint                                        AS sire_avg,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sr."hammerPriceCents"))::bigint AS sire_median
      FROM "Horse" o
      JOIN "SaleRecord" sr ON sr."horseId" = o.id
      WHERE sr."hammerPriceCents" > 0
        AND o.pedigree->>'sire' IS NOT NULL
        AND o.pedigree->>'sire' != ''
        AND o.pedigree->>'sire' != 'null'
      GROUP BY o.pedigree->>'sire'
      HAVING COUNT(sr.id) >= 3
    )
    SELECT
      o.id                                                                               AS horse_id,
      o.name                                                                             AS horse_name,
      o.pedigree->>'sire'                                                                AS sire,
      sr.id                                                                              AS sale_id,
      sr."hammerPriceCents"::bigint                                                      AS sale_price,
      sr."saleDate"                                                                      AS sale_date,
      sr."saleSessionName"                                                               AS sale_session,
      ss.sire_avg,
      ss.sire_median,
      ss.sire_count,
      ROUND((sr."hammerPriceCents"::float / NULLIF(ss.sire_avg::float, 0)) * 100) / 100 AS ratio
    FROM "Horse" o
    JOIN "SaleRecord" sr ON sr."horseId" = o.id
    JOIN sire_stats ss ON ss.sire_name = o.pedigree->>'sire'
    WHERE sr."hammerPriceCents" > 0
    ORDER BY ratio DESC
  `

  const comparables = rows.map((r) => ({
    horseId: r.horse_id,
    horseName: r.horse_name,
    sire: r.sire,
    saleId: r.sale_id,
    salePrice: Number(r.sale_price),
    saleDate: r.sale_date,
    saleSession: r.sale_session,
    sireAvg: Number(r.sire_avg),
    sireMedian: Number(r.sire_median),
    sireCount: Number(r.sire_count),
    // ratio > 1 = sold above sire-group average (potentially overvalued)
    // ratio < 1 = sold below sire-group average (potentially undervalued)
    ratio: Number(r.ratio),
  }))

  res.json({ comparables })
})

export default router
