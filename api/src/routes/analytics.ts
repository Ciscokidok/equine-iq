import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

// GET /api/analytics/valuation/stallions
// Returns all sires with progeny sale data, left-joined to catalog for stud fee
router.get('/valuation/stallions', requireAuth, async (_req: Request, res: Response) => {
  type StallionRow = {
    catalog_id: string | null
    sire_name: string
    stud_fee: number | null
    progeny_count: bigint
    avg_price: bigint
    median_price: bigint
    min_price: bigint
    max_price: bigint
  }

  try {
    const rows = await prisma.$queryRaw<StallionRow[]>`
      SELECT
        s.id                                                                          AS catalog_id,
        o.pedigree->>'sire'                                                           AS sire_name,
        s."studFee"                                                                   AS stud_fee,
        COUNT(sr.id)::int                                                             AS progeny_count,
        ROUND(AVG(sr."hammerPriceCents"))::bigint                                     AS avg_price,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sr."hammerPriceCents"))::bigint AS median_price,
        MIN(sr."hammerPriceCents")::bigint                                            AS min_price,
        MAX(sr."hammerPriceCents")::bigint                                            AS max_price
      FROM "Horse" o
      JOIN "SaleRecord" sr ON sr."horseId" = o.id
      LEFT JOIN "Horse" s
        ON LOWER(s.name) = LOWER(o.pedigree->>'sire')
        AND s.sex = 'stallion'
        AND NOT EXISTS (
          SELECT 1 FROM "SaleRecord" sr2 WHERE sr2."horseId" = s.id
        )
      WHERE sr."hammerPriceCents" > 0
        AND o.pedigree->>'sire' IS NOT NULL
        AND o.pedigree->>'sire' != ''
        AND o.pedigree->>'sire' != 'null'
      GROUP BY s.id, o.pedigree->>'sire', s."studFee"
      HAVING COUNT(sr.id) >= 2
      ORDER BY COUNT(sr.id) DESC
    `

    const stallions = rows.map((r) => {
      const avgPrice = Number(r.avg_price)
      const studFee = r.stud_fee ?? null
      const ratio = studFee && avgPrice > 0 ? studFee / avgPrice : null
      return {
        id: r.catalog_id ?? null,
        name: r.sire_name,
        studFee,
        progenyCount: Number(r.progeny_count),
        avgProgenyPrice: avgPrice,
        medianProgenyPrice: Number(r.median_price),
        minProgenyPrice: Number(r.min_price),
        maxProgenyPrice: Number(r.max_price),
        studFeeToAvgRatio: ratio,
        inCatalog: r.catalog_id !== null,
      }
    })

    res.json({ stallions })
  } catch (e: unknown) {
    console.error('[stallions-valuation]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Query failed' })
  }
})

// GET /api/analytics/valuation/comparables
// Returns individual horses ranked against their sire-group average
router.get('/valuation/comparables', requireAuth, async (req: Request, res: Response) => {
  const sire = (req.query.sire as string) || null

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
    ratio: string
  }

  type SireRow = { sire_name: string }

  try {
    // Return the list of sires with 2+ offspring sold so the client can populate its filter
    const sireRows = await prisma.$queryRaw<SireRow[]>`
      SELECT o.pedigree->>'sire' AS sire_name
      FROM "Horse" o
      JOIN "SaleRecord" sr ON sr."horseId" = o.id
      WHERE sr."hammerPriceCents" > 0
        AND o.pedigree->>'sire' IS NOT NULL
        AND o.pedigree->>'sire' != ''
        AND o.pedigree->>'sire' != 'null'
      GROUP BY o.pedigree->>'sire'
      HAVING COUNT(sr.id) >= 2
      ORDER BY o.pedigree->>'sire'
    `
    const sires = sireRows.map((r) => r.sire_name)

    // If no sire filter is provided return metadata only (sire list) so the page
    // can render the filter dropdown without fetching thousands of rows up front.
    if (!sire) {
      res.json({ comparables: [], sires, requiresSireFilter: true })
      return
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
          AND o.pedigree->>'sire' = ${sire}
        GROUP BY o.pedigree->>'sire'
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
      LIMIT 500
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
      ratio: parseFloat(r.ratio as unknown as string),
    }))

    res.json({ comparables, sires, requiresSireFilter: false })
  } catch (e: unknown) {
    console.error('[comparables]', e)
    res.status(500).json({ error: e instanceof Error ? e.message : 'Query failed' })
  }
})

// GET /api/analytics/valuation/pinhooking
// Horses sold 2+ times — compute price delta and ROI between sales
router.get('/valuation/pinhooking', requireAuth, async (_req: Request, res: Response) => {
  type PinhookRow = {
    horse_id: string
    horse_name: string
    sire: string | null
    sale_count: bigint
    sales: Array<{ price: number; date: Date; session: string | null }>
  }

  const rows = await prisma.$queryRaw<Array<{
    horse_id: string
    horse_name: string
    sire: string | null
    sale_count: bigint
    prices: number[]
    dates: Date[]
    sessions: Array<string | null>
  }>>`
    SELECT
      h.id                                    AS horse_id,
      h.name                                  AS horse_name,
      h.pedigree->>'sire'                     AS sire,
      COUNT(sr.id)::int                       AS sale_count,
      ARRAY_AGG(sr."hammerPriceCents" ORDER BY sr."saleDate") AS prices,
      ARRAY_AGG(sr."saleDate"        ORDER BY sr."saleDate") AS dates,
      ARRAY_AGG(sr."saleSessionName" ORDER BY sr."saleDate") AS sessions
    FROM "Horse" h
    JOIN "SaleRecord" sr ON sr."horseId" = h.id
    WHERE sr."hammerPriceCents" > 0
    GROUP BY h.id, h.name, h.pedigree
    HAVING COUNT(sr.id) >= 2
    ORDER BY h.name
  `

  const horses = rows.map((r) => {
    const prices = r.prices.map(Number)
    const firstPrice = prices[0]
    const lastPrice = prices[prices.length - 1]
    const roi = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : null
    const sales = prices.map((price, i) => ({
      price,
      date: r.dates[i],
      session: r.sessions[i],
    }))
    return {
      horseId: r.horse_id,
      horseName: r.horse_name,
      sire: r.sire,
      saleCount: Number(r.sale_count),
      firstPrice,
      lastPrice,
      roiPct: roi !== null ? Math.round(roi * 10) / 10 : null,
      priceDelta: lastPrice - firstPrice,
      sales,
    }
  })

  res.json({ horses })
})

// GET /api/analytics/valuation/consignors
// Consignor track record vs sire-group benchmarks
router.get('/valuation/consignors', requireAuth, async (_req: Request, res: Response) => {
  type ConsignorRow = {
    consignor: string
    sale_count: bigint
    avg_price: bigint
    median_price: bigint
    total_volume: bigint
    beats_sire_avg: bigint
    avg_vs_sire_pct: number | null
  }

  const rows = await prisma.$queryRaw<ConsignorRow[]>`
    WITH sire_stats AS (
      SELECT
        o.pedigree->>'sire'           AS sire_name,
        AVG(sr."hammerPriceCents")    AS sire_avg
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
      sr."consignorName"                                                                     AS consignor,
      COUNT(sr.id)::int                                                                      AS sale_count,
      ROUND(AVG(sr."hammerPriceCents"))::bigint                                              AS avg_price,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sr."hammerPriceCents"))::bigint      AS median_price,
      SUM(sr."hammerPriceCents")::bigint                                                     AS total_volume,
      COUNT(CASE WHEN ss.sire_avg IS NOT NULL AND sr."hammerPriceCents" > ss.sire_avg THEN 1 END)::int AS beats_sire_avg,
      ROUND(AVG(
        CASE WHEN ss.sire_avg IS NOT NULL AND ss.sire_avg > 0
          THEN sr."hammerPriceCents"::float / ss.sire_avg::float * 100
        END
      ))                                                                                     AS avg_vs_sire_pct
    FROM "SaleRecord" sr
    JOIN "Horse" h ON h.id = sr."horseId"
    LEFT JOIN sire_stats ss ON ss.sire_name = h.pedigree->>'sire'
    WHERE sr."consignorName" IS NOT NULL
      AND sr."consignorName" != ''
      AND sr."hammerPriceCents" > 0
    GROUP BY sr."consignorName"
    HAVING COUNT(sr.id) >= 2
    ORDER BY avg_vs_sire_pct DESC NULLS LAST
  `

  const consignors = rows.map((r) => ({
    consignor: r.consignor,
    saleCount: Number(r.sale_count),
    avgPrice: Number(r.avg_price),
    medianPrice: Number(r.median_price),
    totalVolume: Number(r.total_volume),
    beatsSireAvg: Number(r.beats_sire_avg),
    avgVsSirePct: r.avg_vs_sire_pct !== null ? Number(r.avg_vs_sire_pct) : null,
  }))

  res.json({ consignors })
})

// GET /api/analytics/racing-earnings/:horseId
router.get('/racing-earnings/:horseId', requireAuth, async (req: Request, res: Response) => {
  const record = await prisma.racingEarnings.findUnique({ where: { horseId: req.params.horseId } })
  res.json({ earnings: record ?? null })
})

// PUT /api/analytics/racing-earnings/:horseId
router.put('/racing-earnings/:horseId', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { totalEarningsCents, starts, wins, places, shows, bestRaceClass, notes, sourceUrl } = req.body as {
    totalEarningsCents?: number
    starts?: number
    wins?: number
    places?: number
    shows?: number
    bestRaceClass?: string
    notes?: string
    sourceUrl?: string
  }

  const horse = await prisma.horse.findUnique({ where: { id: req.params.horseId } })
  if (!horse) { res.status(404).json({ error: 'Horse not found' }); return }

  const record = await prisma.racingEarnings.upsert({
    where: { horseId: req.params.horseId },
    update: {
      totalEarningsCents: totalEarningsCents ?? 0,
      starts: starts ?? null,
      wins: wins ?? null,
      places: places ?? null,
      shows: shows ?? null,
      bestRaceClass: bestRaceClass ?? null,
      notes: notes ?? null,
      sourceUrl: sourceUrl ?? null,
      updatedByUserId: userId,
    },
    create: {
      horseId: req.params.horseId,
      totalEarningsCents: totalEarningsCents ?? 0,
      starts: starts ?? null,
      wins: wins ?? null,
      places: places ?? null,
      shows: shows ?? null,
      bestRaceClass: bestRaceClass ?? null,
      notes: notes ?? null,
      sourceUrl: sourceUrl ?? null,
      updatedByUserId: userId,
    },
  })
  res.json({ earnings: record })
})

// GET /api/analytics/production-costs/:horseId
router.get('/production-costs/:horseId', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const costs = await prisma.productionCost.findMany({
    where: { horseId: req.params.horseId, userId },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
  })
  const totalCents = costs.reduce((sum, c) => sum + c.amountCents, 0)
  res.json({ costs, totalCents })
})

// POST /api/analytics/production-costs/:horseId
router.post('/production-costs/:horseId', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { category, amountCents, year, notes } = req.body as {
    category: string
    amountCents: number
    year: number
    notes?: string
  }
  if (!category || !amountCents || !year) {
    res.status(400).json({ error: 'category, amountCents, and year are required' })
    return
  }
  const cost = await prisma.productionCost.create({
    data: { horseId: req.params.horseId, userId, category, amountCents, year, notes: notes ?? null },
  })
  res.json({ cost })
})

// DELETE /api/analytics/production-costs/:costId
router.delete('/production-costs/entry/:costId', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const cost = await prisma.productionCost.findFirst({ where: { id: req.params.costId, userId } })
  if (!cost) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.productionCost.delete({ where: { id: req.params.costId } })
  res.json({ ok: true })
})

export default router
