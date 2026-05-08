import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'

const router = Router()
router.use(requireAuth, requireAdmin)

router.get('/pending', async (_req: Request, res: Response) => {
  try {
    const approvals = await prisma.bidderApproval.findMany({
      where: { status: 'pending' },
      include: { user: { select: { id: true, email: true, farmName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(approvals)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const approval = await prisma.bidderApproval.findUnique({ where: { id: req.params.id } })
    if (!approval) { res.status(404).json({ error: 'Not found' }); return }
    const updated = await prisma.bidderApproval.update({
      where: { id: req.params.id },
      data: { status: 'approved', approvedAt: new Date() },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/suspend', async (req: Request, res: Response) => {
  try {
    const approval = await prisma.bidderApproval.findUnique({ where: { id: req.params.id } })
    if (!approval) { res.status(404).json({ error: 'Not found' }); return }
    const updated = await prisma.bidderApproval.update({
      where: { id: req.params.id },
      data: { status: 'suspended', suspendedAt: new Date() },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id/deposit-confirmed', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      depositAmount: z.number().int().positive().optional(),
      depositReference: z.string().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

    const approval = await prisma.bidderApproval.findUnique({ where: { id: req.params.id } })
    if (!approval) { res.status(404).json({ error: 'Not found' }); return }

    const updated = await prisma.bidderApproval.update({
      where: { id: req.params.id },
      data: {
        depositConfirmedAt: new Date(),
        ...(parsed.data.depositAmount !== undefined && { depositAmount: parsed.data.depositAmount }),
        ...(parsed.data.depositReference !== undefined && { depositReference: parsed.data.depositReference }),
      },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
