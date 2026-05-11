import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
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

  const token = createToken({ sub: user.id, email: user.email, plan: user.plan, role: user.role })
  res.status(201).json({ token, user: { id: user.id, email: user.email, farmName: user.farmName, plan: user.plan } })
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'Invalid email or password' }); return }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = createToken({ sub: user.id, email: user.email, plan: user.plan, role: user.role })
  res.json({ token, user: { id: user.id, email: user.email, farmName: user.farmName, plan: user.plan } })
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json({ id: user.id, email: user.email, farmName: user.farmName, plan: user.plan })
})

// Claim account after Stripe purchase — set password via one-time token
router.post('/claim', async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
    farmName: z.string().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { token, password, farmName } = parsed.data

  const user = await prisma.user.findUnique({ where: { claimToken: token } })
  if (!user || !user.claimTokenExpiry || user.claimTokenExpiry < new Date()) {
    res.status(400).json({ error: 'Invalid or expired claim token' })
    return
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(password),
      farmName: farmName ?? user.farmName,
      claimToken: null,
      claimTokenExpiry: null,
    },
  })

  const authToken = createToken({ sub: updated.id, email: updated.email, plan: updated.plan, role: updated.role })
  res.json({ token: authToken, user: { id: updated.id, email: updated.email, farmName: updated.farmName, plan: updated.plan } })
})

const GuestRegisterSchema = z.object({
  email: z.string().email(),
  farmName: z.string().optional(),
})

const GuestVerifySchema = z.object({
  token: z.string().min(1),
})

router.post('/guest-register', async (req: Request, res: Response) => {
  const parsed = GuestRegisterSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const { email } = parsed.data
  try {
    const existing = await prisma.guestBidder.findUnique({ where: { email: email.toLowerCase() } })
    if (existing && existing.emailVerified) {
      res.status(409).json({ error: 'Email already registered' }); return
    }
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const guest = await prisma.guestBidder.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), verifyToken: crypto.randomUUID(), verifyExpiry },
      update: { verifyToken: crypto.randomUUID(), verifyExpiry },
    })
    console.log('[guest-register] verify token:', guest.verifyToken)
    res.status(201).json({ message: 'Verification email sent' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/guest-verify', async (req: Request, res: Response) => {
  const parsed = GuestVerifySchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
  const { token } = parsed.data
  try {
    const guest = await prisma.guestBidder.findUnique({ where: { verifyToken: token } })
    if (!guest || !guest.verifyExpiry || guest.verifyExpiry < new Date()) {
      res.status(400).json({ error: 'Invalid or expired token' }); return
    }
    await prisma.guestBidder.update({
      where: { id: guest.id },
      data: { emailVerified: true, verifyToken: null, verifyExpiry: null },
    })
    await prisma.bidderApproval.upsert({
      where: { guestBidderId: guest.id },
      create: { guestBidderId: guest.id, status: 'pending' },
      update: {},
    })
    const secret = process.env.SECRET_KEY
    if (!secret) { res.status(500).json({ error: 'Server configuration error' }); return }
    const jwtToken = jwt.sign({ sub: `guest:${guest.id}`, role: 'guest' }, secret, { expiresIn: '7d' })
    res.json({ token: jwtToken })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
