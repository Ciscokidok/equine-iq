import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

const HorseSchema = z.object({
  name: z.string().min(1),
  breed: z.string().min(1),
  discipline: z.enum(['sport_horse','warmblood','quarter_horse','paint','reining','cutting','barrel_racing','hunter_jumper','dressage','eventing','other']),
  dateOfBirth: z.string().optional(),
  color: z.string().optional(),
  heightHands: z.number().optional(),
  conformationNotes: z.string().optional(),
  performanceRecords: z.array(z.object({
    event: z.string(),
    date: z.string(),
    placement: z.string().optional(),
    score: z.number().optional(),
  })).optional(),
  pedigree: z.record(z.any()).optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const mares = await prisma.horse.findMany({
    where: { sex: 'mare', createdByUser: userId },
    orderBy: { createdAt: 'desc' },
  })
  res.json(mares)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)

  // Free tier cap: 3 mares
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.subscriptionTier === 'free') {
    const count = await prisma.horse.count({ where: { sex: 'mare', createdByUser: userId } })
    if (count >= 3) {
      res.status(403).json({ error: 'Free tier limit reached. Upgrade to Pro for unlimited mares.' })
      return
    }
  }

  const parsed = HorseSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const mare = await prisma.horse.create({
    data: {
      ...parsed.data,
      sex: 'mare',
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined,
      performanceRecords: parsed.data.performanceRecords ?? [],
      pedigree: parsed.data.pedigree ?? {},
      createdByUser: userId,
    },
  })
  res.status(201).json(mare)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const mare = await prisma.horse.findFirst({
    where: { id: req.params.id, sex: 'mare', createdByUser: userId },
  })
  if (!mare) { res.status(404).json({ error: 'Not found' }); return }
  res.json(mare)
})

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.horse.findFirst({ where: { id: req.params.id, createdByUser: userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const parsed = HorseSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const updated = await prisma.horse.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : undefined,
    },
  })
  res.json(updated)
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.horse.findFirst({ where: { id: req.params.id, createdByUser: userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.horse.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
