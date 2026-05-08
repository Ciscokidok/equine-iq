import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { getStallionSaleStats } from '../lib/auctionSaleStats'

const router = Router()

const qs = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const StallionSchema = z.object({
  name: z.string().min(1),
  breed: z.string().min(1),
  discipline: z.enum(['sport_horse','warmblood','quarter_horse','paint','reining','cutting','barrel_racing','flat_racing','thoroughbred_racing','hunter_jumper','dressage','eventing','other']),
  studFee: z.number().optional(),
  studLocation: z.string().optional(),
  studBookingUrl: z.string().url().optional(),
  offspringCount: z.number().default(0),
  offspringPerformanceSummary: z.string().optional(),
  conformationNotes: z.string().optional(),
  registrationNumber: z.string().optional(),
  epdNotes: z.string().optional(),
  externalProfileUrl: z.string().url().optional().or(z.literal('')),
  pedigree: z.record(z.any()).optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const discipline = qs(req.query.discipline)
  const breed = qs(req.query.breed)
  const minFee = qs(req.query.minFee)
  const maxFee = qs(req.query.maxFee)
  const hasOffspringData = qs(req.query.hasOffspringData)
  const q = qs(req.query.q)

  const stallions = await prisma.horse.findMany({
    where: {
      sex: 'stallion',
      OR: [{ createdByUser: null }, { createdByUser: userId }],
      ...(discipline ? { discipline: discipline as any } : {}),
      ...(breed ? { breed: { contains: breed, mode: 'insensitive' } } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(minFee ? { studFee: { gte: parseInt(minFee) } } : {}),
      ...(maxFee ? { studFee: { lte: parseInt(maxFee) } } : {}),
      ...(hasOffspringData === 'true' ? { offspringPerformanceSummary: { not: null } } : {}),
    },
    orderBy: { offspringCount: 'desc' },
    take: 100,
  })
  res.json(stallions)
})

// Bulk import — MUST be before /:id to avoid route conflict
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  const ImportSchema = z.array(StallionSchema).min(1).max(500)
  const parsed = ImportSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const s of parsed.data) {
    try {
      const existing = await prisma.horse.findFirst({
        where: { name: { equals: s.name, mode: 'insensitive' }, sex: 'stallion' },
      })
      if (existing) {
        await prisma.horse.update({
          where: { id: existing.id },
          data: { ...s, pedigree: (s.pedigree ?? existing.pedigree ?? {}) as any },
        })
        updated++
      } else {
        await prisma.horse.create({
          data: { ...s, sex: 'stallion', pedigree: s.pedigree ?? {}, createdByUser: null },
        })
        created++
      }
    } catch (err) {
      errors.push(`${s.name}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  res.json({ created, updated, errors, total: created + updated })
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const parsed = StallionSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const stallion = await prisma.horse.create({
    data: {
      ...parsed.data,
      sex: 'stallion',
      pedigree: parsed.data.pedigree ?? {},
      createdByUser: userId,
    },
  })
  res.status(201).json(stallion)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const stallion = await prisma.horse.findFirst({
    where: {
      id: req.params.id,
      sex: 'stallion',
      OR: [{ createdByUser: null }, { createdByUser: userId }],
    },
  })
  if (!stallion) { res.status(404).json({ error: 'Not found' }); return }
  res.json(stallion)
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

router.get('/:id/auction-sale-stats', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const mareId = typeof req.query.mareId === 'string' ? req.query.mareId : undefined
  if (mareId !== undefined && !UUID_RE.test(mareId)) {
    res.status(400).json({ error: 'mareId must be a valid UUID' }); return
  }

  const stallion = await prisma.horse.findUnique({ where: { id: req.params.id } })
  if (!stallion) { res.status(404).json({ error: 'Not found' }); return }

  const stats = await getStallionSaleStats(req.params.id, userId, mareId)
  res.json(stats)
})

export default router
