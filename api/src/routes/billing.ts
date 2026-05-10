import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { sendEmail } from '../lib/mailer'

const router = Router()

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any })
}

export const PLANS = {
  breeder: {
    name: 'Breeder',
    price: 29,
    priceEnv: 'STRIPE_PRICE_BREEDER',
    description: '5 discovery runs/month · Top 5 results · Full AI analysis',
  },
  professional: {
    name: 'Professional',
    price: 79,
    priceEnv: 'STRIPE_PRICE_PROFESSIONAL',
    description: 'Unlimited runs · Top 10 results · Save & share sessions',
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    priceEnv: 'STRIPE_PRICE_ENTERPRISE',
    description: 'Unlimited · All results · API access · Bulk processing',
  },
}

router.get('/plans', (_req, res) => {
  res.json({
    plans: Object.entries(PLANS).map(([id, p]) => ({ id, ...p, priceEnv: undefined })),
  })
})

// Public checkout — accepts email for new users OR uses auth token for existing users
router.post('/checkout/:plan', async (req: Request, res: Response) => {
  const { plan } = req.params
  if (!PLANS[plan as keyof typeof PLANS]) {
    res.status(400).json({ error: 'Unknown plan' })
    return
  }

  const stripe = getStripe()
  const priceId = process.env[PLANS[plan as keyof typeof PLANS].priceEnv]
  if (!priceId) { res.status(500).json({ error: `Price ID not configured for ${plan}` }); return }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  // Try to get user from auth header (existing user upgrading)
  let customerEmail: string | undefined
  let customerId: string | undefined
  let userId: string | undefined

  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { verifyToken } = await import('../lib/auth')
      const payload = verifyToken(authHeader.slice(7))
      userId = payload.sub
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user) {
        customerEmail = user.email
        customerId = user.stripeCustomerId ?? undefined
      }
    } catch { /* unauthenticated is fine */ }
  }

  // Fall back to email from request body (new user)
  if (!customerEmail && req.body?.email) {
    customerEmail = req.body.email
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    ...(customerId ? { customer: customerId } : {}),
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { plan, ...(userId ? { userId } : {}) },
    success_url: `${frontendUrl}/settings?upgraded=1`,
    cancel_url: `${frontendUrl}/pricing`,
  })

  res.json({ url: session.url })
})

router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  const stripe = getStripe()
  const userId = getUserId(req)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.stripeCustomerId) { res.status(400).json({ error: 'No billing account found' }); return }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${frontendUrl}/settings`,
  })

  res.json({ url: session.url })
})

// Webhook — mounted with express.raw() in index.ts BEFORE express.json()
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.metadata?.type === 'stud_fee') {
          const bookingId = session.metadata.bookingId
          if (bookingId) {
            await prisma.studBooking.update({
              where: { id: bookingId },
              data: { status: 'confirmed', stripeSessionId: session.id },
            })
          }
          break
        }

        const customerId = session.customer as string
        const email = session.customer_details?.email
        const meta = session.metadata || {}
        const plan = (meta.plan as 'breeder' | 'professional' | 'enterprise') || 'breeder'

        if (customerId && email) {
          let user = await prisma.user.findFirst({
            where: { OR: [{ email }, { stripeCustomerId: customerId }] },
          })

          if (!user) {
            // New user — create with no password (claim flow)
            const claimToken = crypto.randomBytes(32).toString('hex')
            const claimTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1h
            user = await prisma.user.create({
              data: {
                email,
                passwordHash: null,
                stripeCustomerId: customerId,
                plan,
                subscriptionStatus: 'active',
                claimToken,
                claimTokenExpiry,
              },
            })

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
            const claimUrl = `${frontendUrl}/account/claim?token=${claimToken}`
            await sendEmail(
              email,
              'Welcome to EquineIQ — Set your password',
              `<p>Welcome to EquineIQ! Your ${plan} subscription is active.</p>
              <p>Click below to set your password and start finding the best stallions for your mares.</p>
              <p><a href="${claimUrl}" style="display:inline-block;padding:12px 20px;background:#4a3728;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Set your password →</a></p>
              <p>This link expires in 1 hour. If it expires, <a href="${frontendUrl}/login">log in</a> and request a new link.</p>`,
            )
          } else {
            await prisma.user.update({
              where: { id: user.id },
              data: { stripeCustomerId: customerId, plan, subscriptionStatus: 'active' },
            })
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer as string } })
        if (user) {
          const priceId = sub.items.data[0]?.price?.id
          let plan: 'breeder' | 'professional' | 'enterprise' | undefined
          if (priceId === process.env.STRIPE_PRICE_BREEDER) plan = 'breeder'
          else if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) plan = 'professional'
          else if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) plan = 'enterprise'

          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: sub.status,
              subscriptionEndDate: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              ...(plan ? { plan } : {}),
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer as string } })
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { plan: 'free', subscriptionStatus: 'canceled' },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: invoice.customer as string } })
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'past_due' } })
        }
        break
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook handling error:', err)
    res.status(500).json({ error: 'Webhook handling failed' })
  }
})

export default router
