import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword, createToken } from '../lib/auth'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  farmName: z.string().optional(),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { email, password, farmName } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return }

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      farmName,
    },
  })

  const token = createToken({ sub: user.id, email: user.email, tier: user.subscriptionTier })
  res.status(201).json({ token, user: { id: user.id, email: user.email, farmName: user.farmName, tier: user.subscriptionTier } })
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid email or password' }); return }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = createToken({ sub: user.id, email: user.email, tier: user.subscriptionTier })
  res.json({ token, user: { id: user.id, email: user.email, farmName: user.farmName, tier: user.subscriptionTier } })
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json({ id: user.id, email: user.email, farmName: user.farmName, tier: user.subscriptionTier })
})

export default router
