import { Router, Request, Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { parseCSV, applyMapping, validateRows } from '../lib/csvParser'

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

export default router
