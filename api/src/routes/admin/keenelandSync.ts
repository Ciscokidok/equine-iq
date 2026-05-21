import { Router, Request, Response } from 'express'
import { requireAdminToken } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'
import { parseCSV, applyMapping, validateRows } from '../../lib/csvParser'
import { getPreset } from '../../lib/columnMappingPresets'
import { executeImport } from '../../lib/importEngine'

const SALES_URL =
  'https://flex.keeneland.com/misc/GenerateJson.do?actionName=SalesSummarySales&paramNames=&paramValues='

function csvUrl(saleId: string): string {
  return (
    'https://flex.keeneland.com/report/Run.do' +
    '?xml=WebSummaryPagesCSV.do&xsl=WebSummaryPagesCSVMixed.xsl' +
    '&mimeType=TXT&contentType=text%2Fcsv&fileName=WebSummaryPagesCSV.csv' +
    `&saleId=${encodeURIComponent(saleId)}` +
    '&sortOrder=hip&csvFlag=true&session=0' +
    '&buyerFilter=&sireFilter=&nameFilter=&damFilter=&consignorFilter=' +
    '&rnaFilter=&outFilter=&hipFilter=&sexFilter=&priceFilter=' +
    '&filterType=C&sortDirection=A&reportName=WebSummaryPagesCSV'
  )
}

interface KeenelandSale {
  sale_id: string
  sale_name: string
  sale_description: string
  begin_date: string
  number_of_sessions: string
}

const router = Router()

// GET /api/admin/keeneland/status — list which sales have been imported
router.get('/status', requireAdminToken, async (_req: Request, res: Response) => {
  const batches = await prisma.importBatch.findMany({
    where: { sourceFileName: { startsWith: 'keeneland_' } },
    select: { sourceFileName: true, status: true, createdCount: true, matchedCount: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ count: batches.length, batches })
})

// POST /api/admin/keeneland/sync
// Body: { userId: string, sinceYear?: number, dryRun?: boolean }
router.post('/sync', requireAdminToken, async (req: Request, res: Response) => {
  const { userId, sinceYear, dryRun } = req.body as {
    userId?: string
    sinceYear?: number
    dryRun?: boolean
  }

  if (!userId) {
    res.status(400).json({ error: 'userId is required' })
    return
  }

  const preset = getPreset('keeneland')
  if (!preset) {
    res.status(500).json({ error: 'keeneland preset not found' })
    return
  }

  const minYear = sinceYear ?? new Date().getFullYear() - 1

  // 1. Fetch sale list from Keeneland
  let allSales: KeenelandSale[]
  try {
    const resp = await fetch(SALES_URL, { headers: { Accept: 'application/json' } })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    allSales = (await resp.json()) as KeenelandSale[]
  } catch (e) {
    res.status(502).json({ error: `Failed to fetch Keeneland sale list: ${(e as Error).message}` })
    return
  }

  // 2. Filter by year (sale_id starts with 4-digit year)
  const eligible = allSales.filter((s) => {
    const year = parseInt(s.sale_id.slice(0, 4), 10)
    return !isNaN(year) && year >= minYear
  })

  // 3. Check which are already imported
  const importedFileNames = new Set(
    (
      await prisma.importBatch.findMany({
        where: {
          sourceFileName: { in: eligible.map((s) => `keeneland_${s.sale_id}`) },
          status: 'completed',
        },
        select: { sourceFileName: true },
      })
    ).map((b) => b.sourceFileName!)
  )

  const toImport = eligible.filter((s) => !importedFileNames.has(`keeneland_${s.sale_id}`))

  if (dryRun) {
    res.json({
      dryRun: true,
      eligible: eligible.length,
      alreadyImported: importedFileNames.size,
      toImport: toImport.length,
      sales: toImport.map((s) => ({ sale_id: s.sale_id, name: s.sale_name, date: s.begin_date })),
    })
    return
  }

  if (toImport.length === 0) {
    res.json({ eligible: eligible.length, alreadyImported: importedFileNames.size, imported: 0, errored: 0, details: [] })
    return
  }

  // 4. Download and import each sale
  const details: object[] = []

  for (const sale of toImport) {
    try {
      const csvResp = await fetch(csvUrl(sale.sale_id))
      if (!csvResp.ok) throw new Error(`HTTP ${csvResp.status}`)
      const csvText = await csvResp.text()
      const buffer = Buffer.from(csvText, 'utf-8')

      const parsed = parseCSV(buffer)
      if (parsed.rows.length === 0) {
        details.push({ sale_id: sale.sale_id, name: sale.sale_name, status: 'skipped', reason: 'empty CSV' })
        continue
      }

      // Keeneland uses '---' for RNA and '0' for Out — blank them so validateRows skips price check
      // Inject begin_date as SaleDate so the Keeneland preset maps it correctly; without this
      // all records default to the import-run date, breaking dedup and skewing avgProgenyPrice.
      const normalized = parsed.rows.map((row) => {
        const price = row['Price']
        const withDate = { ...row, SaleDate: sale.begin_date }
        if (price === '---' || price === '0') return { ...withDate, Price: '' }
        return withDate
      })

      const mapped = applyMapping(normalized, preset.columns)
      const validated = validateRows(mapped)

      const batch = await prisma.importBatch.create({
        data: {
          importedByUserId: userId,
          source: 'csv',
          sourceFileName: `keeneland_${sale.sale_id}`,
          totalRows: parsed.rows.length,
          status: 'processing',
        },
      })

      const result = await executeImport(validated, 'shared', batch.id, userId, preset.defaultDiscipline)

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'completed',
          createdCount: result.createdCount,
          matchedCount: result.matchedCount,
          errorCount: result.errorCount,
          errorLog: result.errorLog as never,
        },
      })

      details.push({
        sale_id: sale.sale_id,
        name: sale.sale_name,
        date: sale.begin_date,
        status: 'imported',
        totalRows: parsed.rows.length,
        created: result.createdCount,
        matched: result.matchedCount,
        errors: result.errorCount,
      })
    } catch (e) {
      details.push({ sale_id: sale.sale_id, name: sale.sale_name, status: 'error', reason: (e as Error).message })
    }
  }

  const imported = details.filter((d) => (d as { status: string }).status === 'imported').length
  const errored = details.filter((d) => (d as { status: string }).status === 'error').length

  res.json({ eligible: eligible.length, alreadyImported: importedFileNames.size, imported, errored, details })
})

export default router
