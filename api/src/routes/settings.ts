import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { encrypt, decrypt } from '../lib/encryption'

const router = Router()

router.get('/openai-key', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openaiApiKeyEncrypted: true, plan: true, subscriptionStatus: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const hasKey = !!user.openaiApiKeyEncrypted
  let maskedKey: string | null = null
  if (hasKey) {
    try {
      const raw = decrypt(user.openaiApiKeyEncrypted!)
      maskedKey = '••••••••••••••••' + raw.slice(-4)
    } catch {
      maskedKey = '••••••••••••••••????'
    }
  }

  res.json({ hasKey, maskedKey, plan: user.plan, subscriptionStatus: user.subscriptionStatus })
})

router.post('/openai-key', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const { apiKey } = req.body

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'Invalid API key' })
    return
  }
  if (!apiKey.startsWith('sk-')) {
    res.status(400).json({ error: 'OpenAI keys must start with sk-' })
    return
  }

  const encrypted = encrypt(apiKey)
  await prisma.user.update({ where: { id: userId }, data: { openaiApiKeyEncrypted: encrypted } })

  res.json({ success: true, maskedKey: '••••••••••••••••' + apiKey.slice(-4) })
})

router.delete('/openai-key', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  await prisma.user.update({ where: { id: userId }, data: { openaiApiKeyEncrypted: null } })
  res.json({ success: true })
})

export default router
