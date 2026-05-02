import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { analyzePairing } from '../services/claude'

const router = Router()

const AnalyzeSchema = z.object({
  mare_id: z.string().uuid(),
  stallion_ids: z.array(z.string()).min(1).max(10),
  goal: z.string().min(5),
})

router.post('/analyze', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const parsed = AnalyzeSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { mare_id, stallion_ids, goal } = parsed.data

  const mare = await prisma.horse.findFirst({
    where: { id: mare_id, sex: 'mare', createdByUser: userId },
  })
  if (!mare) { res.status(404).json({ error: 'Mare not found' }); return }

  const stallions = await prisma.horse.findMany({
    where: {
      id: { in: stallion_ids },
      sex: 'stallion',
      OR: [{ createdByUser: null }, { createdByUser: userId }],
    },
  })

  const discipline = mare.discipline as string

  // Parallelize all Claude calls
  const results = await Promise.all(
    stallions.map(async (stallion) => {
      try {
        const analysis = await analyzePairing(mare, stallion, goal, discipline)
        return { stallion, analysis, error: null }
      } catch (err) {
        return {
          stallion,
          analysis: null,
          error: err instanceof Error ? err.message : 'Analysis failed',
        }
      }
    }),
  )

  const ranked = results
    .filter((r) => r.analysis !== null)
    .sort((a, b) => (b.analysis!.compatibility_score ?? 0) - (a.analysis!.compatibility_score ?? 0))
    .map((r) => ({
      stallion: r.stallion,
      ...r.analysis!,
    }))

  const errors = results.filter((r) => r.error).map((r) => ({ stallion_id: r.stallion.id, error: r.error }))

  res.json({ results: ranked, errors })
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const schema = z.object({
    mare_id: z.string(),
    stallion_id: z.string(),
    compatibility_score: z.number(),
    score_breakdown: z.record(z.number()),
    reasoning: z.string(),
    risk_flags: z.array(z.any()).default([]),
    top_strengths: z.array(z.string()).default([]),
    considerations: z.array(z.string()).default([]),
    goal: z.string(),
    notes: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const d = parsed.data
  const pairing = await prisma.matingPairing.create({
    data: {
      userId,
      saved: true,
      mareId: d.mare_id,
      stallionId: d.stallion_id,
      compatibilityScore: d.compatibility_score,
      scoreBreakdown: d.score_breakdown,
      reasoning: d.reasoning,
      riskFlags: d.risk_flags,
      topStrengths: d.top_strengths,
      considerations: d.considerations,
      goal: d.goal,
      notes: d.notes,
    },
  })
  res.status(201).json(pairing)
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const pairings = await prisma.matingPairing.findMany({
    where: { userId },
    include: {
      mare: { select: { name: true, breed: true, discipline: true } },
      stallion: { select: { name: true, breed: true, studFee: true, studLocation: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(pairings)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const pairing = await prisma.matingPairing.findFirst({
    where: { id: req.params.id, userId },
    include: {
      mare: true,
      stallion: true,
    },
  })
  if (!pairing) { res.status(404).json({ error: 'Not found' }); return }
  res.json(pairing)
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const existing = await prisma.matingPairing.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) { res.status(404).json({ error: 'Not found' }); return }

  await prisma.matingPairing.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
