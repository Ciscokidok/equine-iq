import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.get('/mine', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/documents/upload-url', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/configure', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/cancel', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/seller-decision', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
