import { Router, Request, Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { requireAdmin } from '../middleware/admin'
import { parseCSV, applyMapping, validateRows } from '../lib/csvParser'
import { getPreset } from '../lib/columnMappingPresets'
import { executeImport } from '../lib/importEngine'
import { decrypt } from '../lib/encryption'
import { getAdapter } from '../lib/dataProviders/registry'

const KEENELAND_SALES_URL =
  'https://flex.keeneland.com/misc/GenerateJson.do?actionName=SalesSummarySales&paramNames=&paramValues='

function keenelandCsvUrl(saleId: string): string {
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
  begin_date: string
}

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// POST /api/import/upload
router.post('/upload', requireAuth, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File exceeds 10 MB limit' })
      return
    }
    if (err) {
      res.status(400).json({ error: 'Upload failed' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }
    const mime = req.file.mimetype
    const ext = req.file.originalname.split('.').pop()?.toLowerCase()
    if (mime !== 'text/csv' && ext !== 'csv') {
      res.status(400).json({ error: 'Only CSV files are accepted' })
      return
    }
    let parsed: ReturnType<typeof parseCSV>
    try {
      parsed = parseCSV(req.file.buffer)
    } catch {
      res.status(400).json({ error: 'Failed to parse CSV' })
      return
    }
    if (parsed.rows.length === 0) {
      res.status(400).json({ error: 'CSV contains no data rows' })
      return
    }
    res.json({
      headers: parsed.headers,
      preview: parsed.rows.slice(0, 10),
      totalRows: parsed.rows.length,
      rawRows: parsed.rows,
    })
  })
})

const previewSchema = z.object({
  mappingConfig: z.record(z.string()),
  rows: z.array(z.record(z.string())),
})

// POST /api/import/preview
router.post('/preview', requireAuth, async (req: Request, res: Response) => {
  const body = previewSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'Invalid request body', details: body.error.issues })
    return
  }
  const { mappingConfig, rows } = body.data
  const userId = getUserId(req)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = applyMapping(rows, mappingConfig as any)
  const validated = validateRows(mapped)

  // Dedup: match by name across user-owned and shared catalog (pedigree sire/dam in JSON, match name only)
  const result = await Promise.all(
    validated.map(async (row) => {
      if (row._status === 'valid' && row.horseName) {
        const existing = await prisma.horse.findFirst({
          where: {
            name: row.horseName,
            OR: [{ createdByUser: userId }, { createdByUser: null }],
          },
        })
        if (existing) {
          return { ...row, _status: 'matched' as const, matchedHorseId: existing.id }
        }
      }
      return row
    })
  )

  const validCount = result.filter((r) => r._status === 'valid').length
  const matchedCount = result.filter((r) => r._status === 'matched').length
  const errorCount = result.filter((r) => r._status === 'error').length

  res.json({ validCount, matchedCount, errorCount, rows: result })
})

const executeSchema = z.object({
  mappingConfig: z.record(z.string()),
  rows: z.array(z.record(z.string())),
  ownership: z.enum(['personal', 'shared']),
  presetName: z.string().optional(),
  sourceFileName: z.string().optional(),
})

// POST /api/import/execute — 60s timeout set in index.ts for this router (see AD-7)
router.post('/execute', requireAuth, async (req: Request, res: Response) => {
  const body = executeSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'Invalid request body', details: body.error.issues })
    return
  }
  const { mappingConfig, rows, ownership, presetName, sourceFileName } = body.data
  const userId = getUserId(req)
  const preset = presetName ? getPreset(presetName) : null

  const batch = await prisma.importBatch.create({
    data: {
      importedByUserId: userId,
      source: 'csv',
      sourceFileName: sourceFileName ?? null,
      totalRows: rows.length,
      status: 'processing',
    },
  })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = applyMapping(rows, mappingConfig as any)
    const validated = validateRows(mapped)
    const result = await executeImport(validated, ownership, batch.id, userId, preset?.defaultDiscipline)

    const updated = await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'completed',
        createdCount: result.createdCount,
        matchedCount: result.matchedCount,
        errorCount: result.errorCount,
        errorLog: result.errorLog,
      },
    })
    res.json({ ...updated, pedigreeSuggestions: result.pedigreeSuggestions })
  } catch (e: unknown) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: 'failed' },
    })
    res.status(500).json({ error: e instanceof Error ? e.message : 'Import failed' })
  }
})

// GET /api/import/history
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const batches = await prisma.importBatch.findMany({
    where: { importedByUserId: userId },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ batches })
})

// GET /api/import/history/:batchId
router.get('/history/:batchId', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const batch = await prisma.importBatch.findFirst({
    where: { id: req.params.batchId, importedByUserId: userId },
  })
  if (!batch) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json(batch)
})

// GET /api/import/providers
router.get('/providers', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const userConfigs = await prisma.userProviderConfig.findMany({ where: { userId } })
  const tjcis = await prisma.platformProviderConfig.findUnique({ where: { provider: 'tjcis' } })

  const providers = [
    ...userConfigs.map((c) => ({
      provider: c.provider,
      configured: true,
      testStatus: c.testStatus,
      platformManaged: false,
    })),
    ...(tjcis?.active
      ? [{ provider: 'tjcis', configured: true, testStatus: null, platformManaged: true }]
      : []),
  ]
  res.json({ providers })
})

// GET /api/import/providers/:provider/search
router.get('/providers/:provider/search', requireAuth, async (req: Request, res: Response) => {
  const { provider } = req.params
  const q = req.query.q as string
  if (!q || q.length < 2) {
    res.status(400).json({ error: 'q must be at least 2 characters' })
    return
  }
  const userId = getUserId(req)

  let credential: string
  if (provider === 'tjcis') {
    const platform = await prisma.platformProviderConfig.findUnique({ where: { provider: 'tjcis' } })
    if (!platform?.active) {
      res.status(403).json({ error: 'Equineline access is not available — contact support' })
      return
    }
    credential = decrypt(platform.encryptedCredential)
  } else {
    const config = await prisma.userProviderConfig.findUnique({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { userId_provider: { userId, provider: provider as any } },
    })
    if (!config) {
      res.status(403).json({ error: `Connect ${provider} in Settings → Data Sources` })
      return
    }
    credential = decrypt(config.encryptedCredential)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = getAdapter(provider as any, credential)
    const results = await adapter.search(q)
    res.json({ results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: `${provider} returned an error: ${msg}` })
  }
})

// POST /api/import/providers/:provider/fetch
const fetchSchema = z.object({ providerRef: z.string().min(1) })

router.post('/providers/:provider/fetch', requireAuth, async (req: Request, res: Response) => {
  const { provider } = req.params
  const body = fetchSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'providerRef is required' })
    return
  }
  const userId = getUserId(req)
  const config = await prisma.userProviderConfig.findUnique({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { userId_provider: { userId, provider: provider as any } },
  })
  if (!config) {
    res.status(403).json({ error: `Connect ${provider} in Settings → Data Sources` })
    return
  }
  try {
    const credential = decrypt(config.encryptedCredential)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = getAdapter(provider as any, credential)
    const sales = await adapter.fetchSaleHistory(body.data.providerRef)
    res.json({ rows: sales })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: `${provider} returned an error: ${msg}` })
  }
})

const linkPedigreeSchema = z.object({
  horseId: z.string(),
  field: z.enum(['sire', 'dam']),
  targetHorseId: z.string(),
})

// POST /api/import/link-pedigree
router.post('/link-pedigree', requireAuth, async (req: Request, res: Response) => {
  const body = linkPedigreeSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'Invalid request body', details: body.error.issues })
    return
  }
  const { horseId, field, targetHorseId } = body.data
  const userId = getUserId(req)

  const horse = await prisma.horse.findFirst({
    where: { id: horseId, OR: [{ createdByUser: userId }, { createdByUser: null }] },
  })
  if (!horse) {
    res.status(404).json({ error: 'Horse not found' })
    return
  }

  const target = await prisma.horse.findUnique({ where: { id: targetHorseId } })
  if (!target) {
    res.status(404).json({ error: 'Target horse not found' })
    return
  }

  const existingPedigree = (horse.pedigree ?? {}) as Record<string, string>
  const updated = await prisma.horse.update({
    where: { id: horseId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { pedigree: { ...existingPedigree, [`${field}Id`]: targetHorseId } as any },
  })
  res.json({ ok: true, horseId: updated.id, field, linkedTo: targetHorseId })
})

// GET /api/import/keeneland/status
router.get('/keeneland/status', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const batches = await prisma.importBatch.findMany({
    where: { sourceFileName: { startsWith: 'keeneland_' } },
    select: { id: true, sourceFileName: true, status: true, createdCount: true, matchedCount: true, errorCount: true, totalRows: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ count: batches.length, batches })
})

// POST /api/import/keeneland/sync
router.post('/keeneland/sync', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { sinceYear, dryRun } = req.body as { sinceYear?: number; dryRun?: boolean }

  const preset = getPreset('keeneland')
  if (!preset) { res.status(500).json({ error: 'keeneland preset not found' }); return }

  const minYear = sinceYear ?? new Date().getFullYear() - 1

  let allSales: KeenelandSale[]
  try {
    const resp = await fetch(KEENELAND_SALES_URL, { headers: { Accept: 'application/json' } })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    allSales = (await resp.json()) as KeenelandSale[]
  } catch (e) {
    res.status(502).json({ error: `Failed to fetch Keeneland sale list: ${(e as Error).message}` })
    return
  }

  const eligible = allSales.filter((s) => {
    const year = parseInt(s.sale_id.slice(0, 4), 10)
    return !isNaN(year) && year >= minYear
  })

  const importedFileNames = new Set(
    (await prisma.importBatch.findMany({
      where: {
        sourceFileName: { in: eligible.map((s) => `keeneland_${s.sale_id}`) },
        status: 'completed',
      },
      select: { sourceFileName: true },
    })).map((b) => b.sourceFileName!)
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
    res.json({ eligible: eligible.length, alreadyImported: importedFileNames.size, started: false, imported: 0, errored: 0, details: [] })
    return
  }

  // Return immediately — sync runs in background to avoid Render's 30s HTTP timeout
  res.json({ started: true, eligible: eligible.length, alreadyImported: importedFileNames.size, toImport: toImport.length })

  // Background processing — response already sent
  ;(async () => {
    for (const sale of toImport) {
      try {
        const csvResp = await fetch(keenelandCsvUrl(sale.sale_id))
        if (!csvResp.ok) throw new Error(`HTTP ${csvResp.status}`)
        const buffer = Buffer.from(await csvResp.text(), 'utf-8')

        const parsed = parseCSV(buffer)
        if (parsed.rows.length === 0) continue

        const normalized = parsed.rows.map((row) => {
          const price = row['Price']
          if (price === '---' || price === '0') return { ...row, Price: '' }
          return row
        })

        const mapped = applyMapping(normalized, preset.columns)
        const validated = validateRows(mapped)

        const batch = await prisma.importBatch.create({
          data: { importedByUserId: userId, source: 'csv', sourceFileName: `keeneland_${sale.sale_id}`, totalRows: parsed.rows.length, status: 'processing' },
        })

        const result = await executeImport(validated, 'shared', batch.id, userId, preset.defaultDiscipline)

        await prisma.importBatch.update({
          where: { id: batch.id },
          data: { status: 'completed', createdCount: result.createdCount, matchedCount: result.matchedCount, errorCount: result.errorCount, errorLog: result.errorLog as never },
        })
      } catch (e) {
        console.error(`[keeneland-sync] failed sale ${sale.sale_id}:`, e)
      }
    }
    console.log(`[keeneland-sync] background sync complete for ${toImport.length} sales`)
  })().catch(console.error)
})

export default router
