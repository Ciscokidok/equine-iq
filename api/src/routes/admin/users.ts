import { Router, Request, Response } from 'express'
import { requireAdminToken } from '../../middleware/admin'
import { prisma } from '../../lib/prisma'

const router = Router()

// POST /api/admin/users/promote  body: { email, role }
// Protected by static ADMIN_TOKEN — used to bootstrap admin accounts
router.post('/promote', requireAdminToken, async (req: Request, res: Response) => {
  const { email, role } = req.body as { email?: string; role?: string }
  if (!email) { res.status(400).json({ error: 'email is required' }); return }
  const newRole = role ?? 'admin'

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: newRole },
    select: { id: true, email: true, role: true },
  })
  res.json({ ok: true, user: updated })
})

export default router
