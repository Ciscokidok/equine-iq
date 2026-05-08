import { Router, Request, Response } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'
import { listRegistered, listActive, activateAdapter, deactivateAdapter } from '../../lib/adapters/registry'

const router = Router()

router.get('/', requireAuth, requireAdmin, (_req: Request, res: Response) => {
  res.json({ registered: listRegistered(), active: listActive() })
})

router.patch('/:source/activate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await activateAdapter(req.params.source as any)
    res.json({ activated: req.params.source })
  } catch (err) {
    res.status(422).json({ error: (err as Error).message })
  }
})

router.patch('/:source/deactivate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await deactivateAdapter(req.params.source as any)
    res.json({ deactivated: req.params.source })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

export default router
