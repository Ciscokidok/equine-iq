import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth, getUserId } from '../middleware/auth'
import { requireAdmin } from '../middleware/admin'
import { prisma } from '../lib/prisma'
import { broadcastBidUpdate } from '../lib/auctionSocket'
import { getPresignedDownloadUrl } from '../lib/s3Upload'

const DISCIPLINE_VALUES = ['sport_horse', 'warmblood', 'quarter_horse', 'paint', 'reining', 'cutting', 'barrel_racing', 'flat_racing', 'thoroughbred_racing', 'hunter_jumper', 'dressage', 'eventing', 'other'] as const

async function resolveAutoBids(auctionId: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
    if (!auction || auction.status !== 'open') break

    const challenger = await prisma.bid.findFirst({
      where: {
        auctionId,
        isAutoBid: true,
        autoMaxAmount: { not: null, gt: auction.currentBid },
        userId: { not: auction.highBidderId },
      },
      orderBy: { autoMaxAmount: 'desc' },
    })
    if (!challenger || !challenger.userId) break

    const nextAmount = auction.currentBid + auction.bidIncrement
    if (nextAmount > (challenger.autoMaxAmount ?? 0)) break

    await prisma.$transaction([
      prisma.bid.create({
        data: { auctionId, userId: challenger.userId, amount: nextAmount, isAutoBid: true },
      }),
      prisma.auction.update({
        where: { id: auctionId },
        data: { currentBid: nextAmount, highBidderId: challenger.userId },
      }),
    ])
  }
}

const router = Router()

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const querySchema = z.object({
      breed: z.string().optional(),
      discipline: z.enum(DISCIPLINE_VALUES).optional(),
      status: z.enum(['scheduled', 'open']).optional(),
      minPrice: z.coerce.number().int().optional(),
      maxPrice: z.coerce.number().int().optional(),
    })
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

    const { breed, discipline, status, minPrice, maxPrice } = parsed.data
    const statusFilter = status ? [status] : ['scheduled', 'open']

    const auctions = await prisma.auction.findMany({
      where: {
        status: { in: statusFilter as any },
        ...(minPrice !== undefined && { currentBid: { gte: minPrice } }),
        ...(maxPrice !== undefined && { currentBid: { lte: maxPrice } }),
        listing: {
          horse: {
            ...(breed && { breed }),
            ...(discipline && { discipline }),
          },
        },
      },
      include: {
        listing: {
          select: {
            buyersPremiumPct: true,
            horse: { select: { name: true, breed: true, discipline: true } },
          },
        },
      },
      orderBy: { startAt: 'asc' },
    })

    res.json(auctions.map((a) => ({
      id: a.id,
      status: a.status,
      currentBid: a.currentBid,
      startingBid: a.startingBid,
      bidIncrement: a.bidIncrement,
      buyersPremiumPct: a.listing?.buyersPremiumPct ?? null,
      startAt: a.startAt,
      endsAt: a.endsAt,
      horse: a.listing?.horse
        ? { name: a.listing.horse.name, breed: a.listing.horse.breed, discipline: a.listing.horse.discipline }
        : null,
      photoUrl: null,
    })))
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// STEP-28: Buyer bids dashboard
router.get('/my-bids', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)

    const bids = await prisma.bid.findMany({
      where: { userId },
      include: {
        auction: {
          include: { listing: { include: { horse: { select: { name: true } } } } },
        },
      },
      distinct: ['auctionId'],
      orderBy: { placedAt: 'desc' },
    })

    const autoBids = await prisma.bid.findMany({
      where: { userId, isAutoBid: true, autoMaxAmount: { not: null } },
      select: {
        auctionId: true,
        autoMaxAmount: true,
        auction: { select: { currentBid: true } },
      },
    })

    const result = bids.map((bid) => {
      const { auction } = bid
      let bidStatus: string
      if (auction.status === 'open' && auction.highBidderId === userId) {
        bidStatus = 'winning'
      } else if (auction.status === 'sold' && auction.highBidderId === userId) {
        bidStatus = 'won'
      } else if (auction.status === 'open') {
        bidStatus = 'outbid'
      } else {
        bidStatus = 'closed'
      }
      return {
        auctionId: auction.id,
        horseName: auction.listing?.horse?.name ?? null,
        bidStatus,
        currentBid: auction.currentBid,
        auctionStatus: auction.status,
      }
    })

    res.json({
      bids: result,
      autoBids: autoBids.map((ab) => ({
        auctionId: ab.auctionId,
        autoMaxAmount: ab.autoMaxAmount,
        currentBid: ab.auction.currentBid,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            horse: true,
            vettingDocuments: { where: { scanStatus: 'clean' } },
          },
        },
        bids: {
          include: { user: { select: { email: true, farmName: true } } },
          orderBy: { placedAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!auction) { res.status(404).json({ error: 'Not found' }); return }
    if (['pending_review', 'rejected'].includes(auction.status as string)) {
      res.status(404).json({ error: 'Not found' }); return
    }

    const documents = await Promise.all(
      (auction.listing?.vettingDocuments ?? []).map(async (doc) => ({
        docType: doc.docType,
        fileName: doc.fileName,
        downloadUrl: await getPresignedDownloadUrl(doc.s3Key),
      }))
    )

    const horse = auction.listing?.horse
    const timeRemainingSeconds = auction.status === 'open'
      ? Math.max(0, Math.floor((auction.endsAt.getTime() - Date.now()) / 1000))
      : 0

    const bids = auction.bids.map((bid) => {
      const local = (bid.user?.email ?? '').split('@')[0]
      const initials = local.slice(0, 2).toUpperCase() || '??'
      return { amount: bid.amount, placedAt: bid.placedAt, bidderInitials: initials, isAutoBid: bid.isAutoBid }
    })

    res.json({
      id: auction.id,
      status: auction.status,
      currentBid: auction.currentBid,
      startingBid: auction.startingBid,
      bidIncrement: auction.bidIncrement,
      buyersPremiumPct: auction.listing?.buyersPremiumPct ?? null,
      startAt: auction.startAt,
      endsAt: auction.endsAt,
      timeRemainingSeconds,
      horse: horse ? {
        name: horse.name,
        breed: horse.breed,
        discipline: horse.discipline,
        sex: horse.sex,
        dateOfBirth: horse.dateOfBirth,
        pedigree: horse.pedigree,
        conformationNotes: horse.conformationNotes,
        performanceRecords: horse.performanceRecords,
        color: horse.color,
        heightHands: horse.heightHands,
        registrationNumber: horse.registrationNumber,
      } : null,
      documents,
      bids,
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/bid', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      amount: z.number().int().positive(),
      isAutoBid: z.boolean().default(false),
      autoMaxAmount: z.number().int().positive().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

    const userId = getUserId(req)
    const { id } = req.params
    const { amount, isAutoBid, autoMaxAmount } = parsed.data

    const auction = await prisma.auction.findUnique({ where: { id } })
    if (!auction) { res.status(404).json({ error: 'Auction not found' }); return }
    if (auction.status !== 'open') { res.status(400).json({ error: 'Auction is not open' }); return }

    const approval = await prisma.bidderApproval.findUnique({ where: { userId } })
    if (!approval || approval.status !== 'approved') {
      res.status(403).json({ error: 'Bidder not approved' })
      return
    }

    const minBid = auction.currentBid === 0 ? auction.startingBid : auction.currentBid + auction.bidIncrement
    if (amount < minBid) {
      res.status(400).json({ error: `Bid must be at least ${minBid}` })
      return
    }

    const txResult = await prisma.$transaction([
      prisma.bid.create({
        data: { auctionId: id, userId, amount, isAutoBid, autoMaxAmount: isAutoBid ? (autoMaxAmount ?? null) : null },
      }),
      prisma.auction.update({
        where: { id },
        data: { currentBid: amount, highBidderId: userId },
      }),
    ])
    const bid = txResult[0]

    await resolveAutoBids(id)

    const updated = await prisma.auction.findUnique({ where: { id } })
    const timeRemainingSeconds = Math.max(0, Math.floor((updated!.endsAt.getTime() - Date.now()) / 1000))
    broadcastBidUpdate(id, { currentBid: updated!.currentBid, timeRemainingSeconds })

    res.status(201).json({ bidId: bid.id, currentBid: updated!.currentBid })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/auto-bid', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/watch', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as any).user?.sub as string | undefined
    const { email } = req.body as { email?: string }

    if (userId) {
      await prisma.auctionWatcher.upsert({
        where: { auctionId_userId: { auctionId: id, userId } },
        update: {},
        create: { auctionId: id, userId },
      })
    } else if (email) {
      await prisma.auctionWatcher.upsert({
        where: { auctionId_email: { auctionId: id, email } },
        update: {},
        create: { auctionId: id, email },
      })
    } else {
      res.status(400).json({ error: 'Provide auth token or email to watch' })
      return
    }
    res.json({ watching: true })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/confirm-payment', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const auction = await prisma.auction.findUnique({ where: { id } })
    if (!auction) { res.status(404).json({ error: 'Auction not found' }); return }
    const updated = await prisma.auction.update({
      where: { id },
      data: { paymentConfirmedAt: new Date() },
    })
    console.log('[payment] confirmed', id)
    res.json({ paymentConfirmedAt: updated.paymentConfirmedAt })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/offer-next-bidder', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const auction = await prisma.auction.findUnique({ where: { id } })
    if (!auction) { res.status(404).json({ error: 'Auction not found' }); return }
    const nextBid = await prisma.bid.findFirst({
      where: { auctionId: id, userId: { not: auction.highBidderId } },
      orderBy: { amount: 'desc' },
    })
    if (!nextBid) { res.status(400).json({ error: 'No other bidders' }); return }
    const offerExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.auction.update({
      where: { id },
      data: { highBidderId: nextBid.userId, sellerDecisionDeadline: offerExpiresAt },
    })
    console.log('[offer-next]', nextBid.userId)
    res.json({ offeredBidderId: nextBid.userId, offerExpiresAt })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
