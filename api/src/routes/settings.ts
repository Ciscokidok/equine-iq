import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { encrypt, decrypt } from '../lib/encryption'
import { z } from 'zod'

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

const VALID_PROVIDERS = ['sporthorse_data', 'equibase', 'tjcis'] as const
type ProviderName = typeof VALID_PROVIDERS[number]

function maskCredential(raw: string): string {
  return '••••••••' + raw.slice(-4)
}

// GET /api/settings/providers
router.get('/providers', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const configs = await prisma.userProviderConfig.findMany({ where: { userId } })
  const userConfigs = configs.map((c) => ({
    provider: c.provider,
    maskedCredential: maskCredential(decrypt(c.encryptedCredential)),
    testStatus: c.testStatus,
    testedAt: c.testedAt,
    platform: false,
  }))
  const tjcis = await prisma.platformProviderConfig.findUnique({ where: { provider: 'tjcis' } })
  res.json({
    providers: [
      ...userConfigs,
      { provider: 'tjcis', active: tjcis?.active ?? false, testStatus: null, platform: true },
    ],
  })
})

const credentialSchema = z.object({ credential: z.string().min(1) })

// POST /api/settings/providers/:provider
router.post('/providers/:provider', requireAuth, async (req: Request, res: Response) => {
  const { provider } = req.params
  if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` })
    return
  }
  const body = credentialSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'credential is required' })
    return
  }
  const userId = getUserId(req)
  const encrypted = encrypt(body.data.credential)
  const config = await prisma.userProviderConfig.upsert({
    where: { userId_provider: { userId, provider: provider as ProviderName } },
    update: { encryptedCredential: encrypted },
    create: { userId, provider: provider as ProviderName, encryptedCredential: encrypted },
  })
  res.json({
    provider: config.provider,
    maskedCredential: maskCredential(body.data.credential),
    testStatus: config.testStatus,
  })
})

// DELETE /api/settings/providers/:provider
router.delete('/providers/:provider', requireAuth, async (req: Request, res: Response) => {
  const { provider } = req.params
  const userId = getUserId(req)
  const existing = await prisma.userProviderConfig.findUnique({
    where: { userId_provider: { userId, provider: provider as ProviderName } },
  })
  if (!existing) {
    res.status(404).json({ error: 'Provider config not found' })
    return
  }
  await prisma.userProviderConfig.delete({
    where: { userId_provider: { userId, provider: provider as ProviderName } },
  })
  res.json({ success: true })
})

// POST /api/settings/providers/:provider/test
router.post('/providers/:provider/test', requireAuth, async (req: Request, res: Response) => {
  const { provider } = req.params
  if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
    res.status(400).json({ error: `Invalid provider: ${provider}` })
    return
  }
  const userId = getUserId(req)
  const config = await prisma.userProviderConfig.findUnique({
    where: { userId_provider: { userId, provider: provider as ProviderName } },
  })
  if (!config) {
    res.status(404).json({ error: 'No credential saved for this provider' })
    return
  }
  let ok = false
  let message = 'Connection failed'
  try {
    const { getAdapter } = await import('../lib/dataProviders/registry')
    const credential = decrypt(config.encryptedCredential)
    const adapter = getAdapter(provider as ProviderName, credential)
    await adapter.testConnection()
    ok = true
    message = 'Connection successful'
  } catch (e: unknown) {
    message = e instanceof Error ? e.message : 'Connection failed'
  }
  await prisma.userProviderConfig.update({
    where: { userId_provider: { userId, provider: provider as ProviderName } },
    data: { testStatus: ok ? 'ok' : 'failed', testedAt: new Date() },
  })
  res.json({ ok, message })
})

export default router
