import { Router, Request, Response } from 'express'
import { requireAdminToken } from '../middleware/admin'

const router = Router()

router.post('/tick', requireAdminToken, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
