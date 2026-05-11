import { Router, Request, Response } from 'express'
import { requireAuth, getUserId } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'

const router = Router()

// POST /api/admin/users/bootstrap  body: { email }
// Works ONLY when zero admin users exist — lets the first admin promote themselves.
// Once any admin exists, returns 403.
router.post('/bootstrap', async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string }
  if (!email) { res.status(400).json({ error: 'email is required' }); return }

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (existingAdmin) {
    res.status(403).json({ error: 'An admin account already exists. Use promote instead.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' },
    select: { id: true, email: true, role: true },
  })
  res.json({ ok: true, user: updated })
})

// POST /api/admin/users/promote  body: { email, role }
// Requires existing admin session.
router.post('/promote', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const actorId = getUserId(req)
  const { email, role } = req.body as { email?: string; role?: string }
  if (!email) { res.status(400).json({ error: 'email is required' }); return }
  if (actorId === email) { res.status(400).json({ error: 'Cannot change your own role' }); return }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: role ?? 'admin' },
    select: { id: true, email: true, role: true },
  })
  res.json({ ok: true, user: updated })
})

export default router
