import { Router, Request, Response } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/queue', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/approve', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/reject', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
