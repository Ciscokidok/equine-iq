import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'
import { encrypt, decrypt } from '../../lib/encryption'
import { getAdapter } from '../../lib/dataProviders/registry'

const router = Router()

function maskCredential(raw: string): string {
  return '••••••••' + raw.slice(-4)
}

// GET /api/admin/platform-providers
router.get('/', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const configs = await prisma.platformProviderConfig.findMany()
  res.json({
    providers: configs.map((c) => ({
      provider: c.provider,
      active: c.active,
      maskedCredential: maskCredential(decrypt(c.encryptedCredential)),
      testedAt: c.testedAt,
    })),
  })
})

const credentialSchema = z.object({ credential: z.string().min(1) })

// POST /api/admin/platform-providers/:provider
router.post('/:provider', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const body = credentialSchema.safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'credential is required' })
    return
  }
  const { provider } = req.params
  const encrypted = encrypt(body.data.credential)
  const config = await prisma.platformProviderConfig.upsert({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { provider: provider as any },
    update: { encryptedCredential: encrypted },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { provider: provider as any, encryptedCredential: encrypted, active: false },
  })
  res.json({
    provider: config.provider,
    active: config.active,
    maskedCredential: maskCredential(body.data.credential),
  })
})

// DELETE /api/admin/platform-providers/:provider
router.delete('/:provider', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { provider } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.platformProviderConfig.deleteMany({ where: { provider: provider as any } })
  res.json({ success: true })
})

// POST /api/admin/platform-providers/:provider/test
router.post('/:provider/test', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { provider } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await prisma.platformProviderConfig.findUnique({ where: { provider: provider as any } })
  if (!config) {
    res.status(404).json({ error: 'No credential configured for this provider' })
    return
  }
  let ok = false
  let message = 'Connection failed'
  try {
    const credential = decrypt(config.encryptedCredential)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = getAdapter(provider as any, credential)
    await adapter.testConnection()
    ok = true
    message = 'Connection successful'
  } catch (e: unknown) {
    message = e instanceof Error ? e.message : 'Connection failed'
  }
  await prisma.platformProviderConfig.update({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { provider: provider as any },
    data: { testedAt: new Date() },
  })
  res.json({ ok, message })
})

// PATCH /api/admin/platform-providers/:provider/toggle
router.patch('/:provider/toggle', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { provider } = req.params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = await prisma.platformProviderConfig.findUnique({ where: { provider: provider as any } })
  if (!config) {
    res.status(404).json({ error: 'Provider not configured' })
    return
  }
  const updated = await prisma.platformProviderConfig.update({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { provider: provider as any },
    data: { active: !config.active },
  })
  res.json({ provider: updated.provider, active: updated.active })
})

export default router
