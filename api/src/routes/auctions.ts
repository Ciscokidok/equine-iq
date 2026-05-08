import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/catalog', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.get('/my-bids', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.get('/:id', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/bid', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/auto-bid', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/watch', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/confirm-payment', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/offer-next-bidder', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
