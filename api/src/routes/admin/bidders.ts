import { Router, Request, Response } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/pending', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/approve', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/suspend', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.patch('/:id/deposit-confirmed', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
