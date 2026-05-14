import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()

router.use(requireAuth, requireAdmin)

const DISCIPLINES = [
  'sport_horse', 'warmblood', 'quarter_horse', 'paint', 'reining', 'cutting',
  'barrel_racing', 'flat_racing', 'thoroughbred_racing', 'hunter_jumper',
  'dressage', 'eventing', 'other',
] as const

const StallionUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  breed: z.string().min(1).optional(),
  discipline: z.enum(DISCIPLINES).optional(),
  studFee: z.number().int().nonnegative().optional().nullable(),
  studLocation: z.string().optional().nullable(),
  studBookingUrl: z.string().url().optional().nullable().or(z.literal('')),
  offspringCount: z.number().int().nonnegative().optional(),
  offspringPerformanceSummary: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  epdNotes: z.string().optional().nullable(),
  externalProfileUrl: z.string().url().optional().nullable().or(z.literal('')),
  pedigree: z.record(z.any()).optional(),
})

const StallionCreateSchema = StallionUpdateSchema.extend({
  name: z.string().min(1),
  breed: z.string().min(1),
  discipline: z.enum(DISCIPLINES),
})

const SELECT = {
  id: true,
  name: true,
  breed: true,
  discipline: true,
  studFee: true,
  studLocation: true,
  studBookingUrl: true,
  offspringCount: true,
  offspringPerformanceSummary: true,
  registrationNumber: true,
  epdNotes: true,
  externalProfileUrl: true,
  pedigree: true,
  lastReviewedAt: true,
  updatedAt: true,
  createdAt: true,
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const stallions = await prisma.horse.findMany({
      where: { sex: 'stallion', createdByUser: null },
      select: SELECT,
      orderBy: { name: 'asc' },
    })
    res.json(stallions)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const parsed = StallionCreateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  try {
    const stallion = await prisma.horse.create({
      data: { ...parsed.data, sex: 'stallion', createdByUser: null },
      select: SELECT,
    })
    res.status(201).json(stallion)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:id', async (req: Request, res: Response) => {
  const parsed = StallionUpdateSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  try {
    const existing = await prisma.horse.findUnique({ where: { id: req.params.id }, select: { createdByUser: true } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.createdByUser !== null) { res.status(403).json({ error: 'Cannot edit user-created stallions' }); return }

    const stallion = await prisma.horse.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: SELECT,
    })
    res.json(stallion)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const lastReviewedAt = new Date()
    await prisma.horse.update({
      where: { id: req.params.id },
      data: { lastReviewedAt },
    })
    res.json({ ok: true, lastReviewedAt })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.horse.findUnique({ where: { id: req.params.id }, select: { createdByUser: true } })
    if (!existing) { res.status(404).json({ error: 'Not found' }); return }
    if (existing.createdByUser !== null) { res.status(403).json({ error: 'Cannot delete user-created stallions' }); return }

    await prisma.horse.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
