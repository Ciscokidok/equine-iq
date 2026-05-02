import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { discipline, breed, minFee, maxFee, hasOffspringData, q } = req.query

  const stallions = await prisma.horse.findMany({
    where: {
      sex: 'stallion',
      OR: [{ createdByUser: null }, { createdByUser: userId }],
      ...(discipline ? { discipline: discipline as any } : {}),
      ...(breed ? { breed: { contains: breed as string, mode: 'insensitive' } } : {}),
      ...(q ? { name: { contains: q as string, mode: 'insensitive' } } : {}),
      ...(minFee ? { studFee: { gte: parseInt(minFee as string) } } : {}),
      ...(maxFee ? { studFee: { lte: parseInt(maxFee as string) } } : {}),
      ...(hasOffspringData === 'true' ? { offspringPerformanceSummary: { not: null } } : {}),
    },
    orderBy: { offspringCount: 'desc' },
    take: 100,
  })
  res.json(stallions)
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

const PrivateStallionSchema = z.object({
  name: z.string().min(1),
  breed: z.string().min(1),
  discipline: z.enum(['sport_horse','warmblood','quarter_horse','paint','reining','cutting','barrel_racing','hunter_jumper','dressage','eventing','other']),
  studFee: z.number().optional(),
  studLocation: z.string().optional(),
  studBookingUrl: z.string().url().optional(),
  offspringCount: z.number().default(0),
  offspringPerformanceSummary: z.string().optional(),
  conformationNotes: z.string().optional(),
  pedigree: z.record(z.any()).optional(),
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const parsed = PrivateStallionSchema.safeParse(req.body)
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

export default router
