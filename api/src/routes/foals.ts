import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

const FoalSchema = z.object({
  mareId: z.string().uuid(),
  name: z.string().optional(),
  sex: z.enum(['mare', 'stallion', 'gelding']).optional(),
  foaledAt: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
  stallionId: z.string().uuid().optional(),
  pairingId: z.string().uuid().optional(),
})

const ResultSchema = z.object({
  event: z.string().min(1),
  eventDate: z.string(),
  placement: z.string().optional(),
  score: z.number().optional(),
  earnings: z.number().optional(),
  notes: z.string().optional(),
})

const AuctionSaleSchema = z.object({
  salePrice: z.number().positive(),
  saleDate: z.string().min(1),
  saleType: z.enum(['weanling', 'yearling', 'two_year_old_in_training', 'mixed_age']),
  auctionHouse: z.string().optional(),
  hipNumber: z.string().optional(),
  buyer: z.string().optional(),
  notes: z.string().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const foals = await prisma.foal.findMany({
    where: { userId },
    include: {
      mare: { select: { id: true, name: true, breed: true } },
      stallion: { select: { id: true, name: true, breed: true } },
      results: { orderBy: { eventDate: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(foals)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const parsed = FoalSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { foaledAt, ...rest } = parsed.data
  const foal = await prisma.foal.create({
    data: {
      ...rest,
      foaledAt: foaledAt ? new Date(foaledAt) : undefined,
      userId,
    },
    include: {
      mare: { select: { id: true, name: true, breed: true } },
      stallion: { select: { id: true, name: true, breed: true } },
      results: true,
    },
  })
  res.status(201).json(foal)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const foal = await prisma.foal.findFirst({
    where: { id: req.params.id, userId },
    include: {
      mare: { select: { id: true, name: true, breed: true } },
      stallion: { select: { id: true, name: true, breed: true } },
      results: { orderBy: { eventDate: 'desc' } },
      auctionSales: { orderBy: { saleDate: 'desc' } },
    },
  })
  if (!foal) { res.status(404).json({ error: 'Not found' }); return }
  res.json(foal)
})

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.foal.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const parsed = FoalSchema.partial().safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { foaledAt, ...rest } = parsed.data
  const foal = await prisma.foal.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      foaledAt: foaledAt ? new Date(foaledAt) : undefined,
    },
    include: {
      mare: { select: { id: true, name: true, breed: true } },
      stallion: { select: { id: true, name: true, breed: true } },
      results: true,
    },
  })
  res.json(foal)
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.foal.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.foal.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

router.post('/:id/auction-sales', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const foal = await prisma.foal.findFirst({ where: { id: req.params.id, userId } })
  if (!foal) { res.status(404).json({ error: 'Not found' }); return }

  const parsed = AuctionSaleSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const sale = await prisma.auctionSale.create({
    data: {
      foalId: foal.id,
      userId,
      salePrice: parsed.data.salePrice,
      saleDate: new Date(parsed.data.saleDate),
      saleType: parsed.data.saleType,
      auctionHouse: parsed.data.auctionHouse,
      hipNumber: parsed.data.hipNumber,
      buyer: parsed.data.buyer,
      notes: parsed.data.notes,
    },
  })
  res.status(201).json(sale)
})

router.get('/:id/auction-sales', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const foal = await prisma.foal.findFirst({ where: { id: req.params.id, userId } })
  if (!foal) { res.status(404).json({ error: 'Not found' }); return }

  const sales = await prisma.auctionSale.findMany({
    where: { foalId: req.params.id },
    orderBy: { saleDate: 'desc' },
  })
  res.json(sales)
})

router.post('/:id/results', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const foal = await prisma.foal.findFirst({ where: { id: req.params.id, userId } })
  if (!foal) { res.status(404).json({ error: 'Not found' }); return }

  const parsed = ResultSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const result = await prisma.foalResult.create({
    data: {
      ...parsed.data,
      eventDate: new Date(parsed.data.eventDate),
      foalId: foal.id,
    },
  })
  res.status(201).json(result)
})

export default router
