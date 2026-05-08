import { Router, Request, Response } from 'express'
import { requireAdminToken } from '../middleware/admin'
import { cronTick } from '../lib/auctionLifecycle'

const router = Router()

router.post('/tick', requireAdminToken, async (_req: Request, res: Response) => {
  try {
    await cronTick()
    res.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[cron] tick failed', err)
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
