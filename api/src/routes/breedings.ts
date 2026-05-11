import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

const MARE_INCLUDE = {
  mare: { select: { id: true, name: true, color: true, dateOfBirth: true } },
  stallion: { select: { id: true, name: true, studFee: true } },
  foal: { select: { id: true, name: true, sex: true, foaledAt: true, color: true } },
} as const

// GET /api/breedings — all breedings for the current user, with mare status
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const breedings = await prisma.breeding.findMany({
    where: { userId },
    include: MARE_INCLUDE,
    orderBy: { bredDate: 'desc' },
  })
  res.json({ breedings })
})

// GET /api/breedings/stud-book — mares with their current breeding status
router.get('/stud-book', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)

  const mares = await prisma.horse.findMany({
    where: { createdByUser: userId, sex: 'mare' },
    select: {
      id: true, name: true, color: true, dateOfBirth: true, breed: true, discipline: true,
      breedingsMare: {
        where: { userId },
        orderBy: { bredDate: 'desc' },
        take: 1,
        include: {
          stallion: { select: { id: true, name: true } },
          foal: { select: { id: true, name: true, sex: true, foaledAt: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = mares.map((mare) => {
    const latest = mare.breedingsMare[0] ?? null
    return {
      id: mare.id,
      name: mare.name,
      color: mare.color,
      dateOfBirth: mare.dateOfBirth,
      breed: mare.breed,
      discipline: mare.discipline,
      latestBreeding: latest ? {
        id: latest.id,
        status: latest.status,
        bredDate: latest.bredDate,
        stallion: latest.stallion,
        studFeeCents: latest.studFeeCents,
        confirmedAt: latest.confirmedAt,
        expectedFoalDate: latest.expectedFoalDate,
        notes: latest.notes,
        foal: latest.foal ?? null,
      } : null,
    }
  })

  // Counts by status for the summary bar
  const counts = { open: 0, bred: 0, confirmed_in_foal: 0, foaled: 0, other: 0 }
  for (const mare of result) {
    const s = mare.latestBreeding?.status
    if (!s) counts.open++
    else if (s === 'bred') counts.bred++
    else if (s === 'confirmed_in_foal') counts.confirmed_in_foal++
    else if (s === 'foaled') counts.foaled++
    else counts.other++
  }

  res.json({ mares: result, counts })
})

// POST /api/breedings — record a new breeding
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { mareId, stallionId, bredDate, studFeeCents, expectedFoalDate, notes } = req.body as {
    mareId: string
    stallionId: string
    bredDate: string
    studFeeCents?: number
    expectedFoalDate?: string
    notes?: string
  }
  if (!mareId || !stallionId || !bredDate) {
    res.status(400).json({ error: 'mareId, stallionId, and bredDate are required' })
    return
  }
  const breeding = await prisma.breeding.create({
    data: {
      userId,
      mareId,
      stallionId,
      bredDate: new Date(bredDate),
      studFeeCents: studFeeCents ?? null,
      expectedFoalDate: expectedFoalDate ? new Date(expectedFoalDate) : null,
      notes: notes ?? null,
    },
    include: MARE_INCLUDE,
  })
  res.json({ breeding })
})

// PATCH /api/breedings/:id — update status, confirm in foal, record foal
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.breeding.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  const { status, confirmedAt, expectedFoalDate, studFeeCents, notes } = req.body as {
    status?: string
    confirmedAt?: string
    expectedFoalDate?: string
    studFeeCents?: number
    notes?: string
  }

  const breeding = await prisma.breeding.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status: status as any }),
      ...(confirmedAt !== undefined && { confirmedAt: confirmedAt ? new Date(confirmedAt) : null }),
      ...(expectedFoalDate !== undefined && { expectedFoalDate: expectedFoalDate ? new Date(expectedFoalDate) : null }),
      ...(studFeeCents !== undefined && { studFeeCents }),
      ...(notes !== undefined && { notes }),
    },
    include: MARE_INCLUDE,
  })
  res.json({ breeding })
})

// POST /api/breedings/:id/foal — record a foal born from this breeding
router.post('/:id/foal', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const breeding = await prisma.breeding.findFirst({
    where: { id: req.params.id, userId },
    include: { foal: true },
  })
  if (!breeding) { res.status(404).json({ error: 'Not found' }); return }
  if (breeding.foal) { res.status(409).json({ error: 'A foal is already recorded for this breeding' }); return }

  const { name, sex, foaledAt, color, notes } = req.body as {
    name?: string
    sex?: string
    foaledAt: string
    color?: string
    notes?: string
  }
  if (!foaledAt) { res.status(400).json({ error: 'foaledAt is required' }); return }

  const [foal] = await prisma.$transaction([
    prisma.foal.create({
      data: {
        userId,
        mareId: breeding.mareId,
        stallionId: breeding.stallionId,
        breedingId: breeding.id,
        foaledAt: new Date(foaledAt),
        name: name ?? null,
        sex: sex as any ?? null,
        color: color ?? null,
        notes: notes ?? null,
      },
    }),
    prisma.breeding.update({
      where: { id: breeding.id },
      data: { status: 'foaled' },
    }),
  ])
  res.json({ foal })
})

// DELETE /api/breedings/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.breeding.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.breeding.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
