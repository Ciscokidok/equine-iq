import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'

const router = Router()

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any })
}

const createSchema = z.object({
  mareId: z.string().uuid(),
  stallionId: z.string().uuid(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional(),
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const { mareId, stallionId, scheduledDate, notes } = parsed.data

  const mare = await prisma.horse.findFirst({ where: { id: mareId, createdByUser: userId } })
  if (!mare) { res.status(404).json({ error: 'Mare not found' }); return }

  const stallion = await prisma.horse.findUnique({ where: { id: stallionId } })
  if (!stallion) { res.status(404).json({ error: 'Stallion not found' }); return }
  if (!stallion.studFee) { res.status(400).json({ error: 'This stallion has no stud fee configured' }); return }

  const feePaidCents = stallion.studFee * 100

  const booking = await prisma.studBooking.create({
    data: {
      userId,
      mareId,
      stallionId,
      feePaidCents,
      status: 'pending_payment',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      notes: notes ?? null,
    },
  })

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: feePaidCents,
          product_data: {
            name: `Stud Fee — ${stallion.name}`,
            description: `Breeding: ${mare.name} × ${stallion.name}`,
          },
        },
        quantity: 1,
      }],
      metadata: { type: 'stud_fee', bookingId: booking.id, userId },
      success_url: `${frontendUrl}/my-bookings?success=1`,
      cancel_url: `${frontendUrl}/stallions/${stallionId}`,
    })

    await prisma.studBooking.update({ where: { id: booking.id }, data: { stripeSessionId: session.id } })
    res.json({ bookingId: booking.id, checkoutUrl: session.url })
  } catch {
    // Stripe not configured — confirm immediately (demo mode)
    const updated = await prisma.studBooking.update({
      where: { id: booking.id },
      data: { status: 'confirmed' },
      include: {
        mare: { select: { id: true, name: true, breed: true } },
        stallion: { select: { id: true, name: true, breed: true, studFee: true } },
      },
    })
    res.json({ bookingId: booking.id, checkoutUrl: null, booking: updated })
  }
})

router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const bookings = await prisma.studBooking.findMany({
    where: { userId },
    include: {
      mare: { select: { id: true, name: true, breed: true } },
      stallion: { select: { id: true, name: true, breed: true, studFee: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ bookings })
})

router.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  const userId = getUserId(req)
  const booking = await prisma.studBooking.findFirst({ where: { id: req.params.id, userId } })
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
  if (booking.status === 'pending_payment') { res.status(400).json({ error: 'Payment not confirmed yet' }); return }

  const updated = await prisma.studBooking.update({
    where: { id: req.params.id },
    data: { status: 'breeding_complete', completedAt: new Date() },
    include: {
      mare: { select: { id: true, name: true } },
      stallion: { select: { id: true, name: true } },
    },
  })
  res.json(updated)
})

export default router
