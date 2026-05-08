import { Router, Request, Response } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.patch('/:source/activate', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.patch('/:source/deactivate', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
