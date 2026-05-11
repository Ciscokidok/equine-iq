import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

function computeInbreedingFlags(pedigree: Record<string, any>): Array<{ name: string; count: number; severity: string }> {
  const nameCounts: Record<string, number> = {}

  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    if (node.name) {
      nameCounts[node.name] = (nameCounts[node.name] ?? 0) + 1
    }
    for (const v of Object.values(node)) {
      if (typeof v === 'object') walk(v)
    }
  }

  walk(pedigree)

  return Object.entries(nameCounts)
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({
      name,
      count,
      severity: count >= 3 ? 'high' : 'medium',
    }))
    .sort((a, b) => b.count - a.count)
}

router.get('/:id/sale-history', requireAuth, async (req: Request, res: Response) => {
  const records = await prisma.saleRecord.findMany({
    where: { horseId: req.params.id },
    orderBy: { saleDate: 'desc' },
    select: {
      id: true,
      saleSource: true,
      saleSessionName: true,
      saleDate: true,
      hipNumber: true,
      hammerPriceCents: true,
      buyerName: true,
      consignorName: true,
    },
  })
  res.json({ records })
})

router.get('/:id/pedigree', requireAuth, async (req: Request, res: Response) => {
  const horse = await prisma.horse.findUnique({ where: { id: req.params.id } })
  if (!horse) { res.status(404).json({ error: 'Not found' }); return }

  const pedigree = horse.pedigree as Record<string, any>
  const inbreedingFlags = computeInbreedingFlags(pedigree)

  res.json({
    horse: { id: horse.id, name: horse.name, sex: horse.sex, breed: horse.breed },
    pedigree,
    inbreeding_flags: inbreedingFlags,
  })
})

export default router
