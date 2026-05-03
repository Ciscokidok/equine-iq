import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router({ mergeParams: true })

const CycleSchema = z.object({
  startDate: z.string(),
  notes: z.string().optional(),
})

async function verifyMareOwnership(mareId: string, userId: string): Promise<boolean> {
  const mare = await prisma.horse.findFirst({
    where: { id: mareId, sex: 'mare', createdByUser: userId },
  })
  return !!mare
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { mareId } = req.params as { mareId: string }

  if (!(await verifyMareOwnership(mareId, userId))) {
    res.status(404).json({ error: 'Mare not found' })
    return
  }

  const cycles = await prisma.heatCycle.findMany({
    where: { mareId },
    orderBy: { startDate: 'desc' },
  })
  res.json(cycles)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { mareId } = req.params as { mareId: string }

  if (!(await verifyMareOwnership(mareId, userId))) {
    res.status(404).json({ error: 'Mare not found' })
    return
  }

  const parsed = CycleSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const cycle = await prisma.heatCycle.create({
    data: {
      mareId,
      startDate: new Date(parsed.data.startDate),
      notes: parsed.data.notes,
    },
  })
  res.status(201).json(cycle)
})

router.delete('/:cycleId', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { mareId } = req.params as { mareId: string }

  if (!(await verifyMareOwnership(mareId, userId))) {
    res.status(404).json({ error: 'Mare not found' })
    return
  }

  const existing = await prisma.heatCycle.findFirst({
    where: { id: req.params.cycleId, mareId },
  })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.heatCycle.delete({ where: { id: req.params.cycleId } })
  res.json({ ok: true })
})

export default router
