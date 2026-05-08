import { Router, Request, Response } from 'express'
import { requireAuth, getUserId } from '../middleware/auth'
import { requireAdmin } from '../middleware/admin'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/catalog', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
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

router.get('/:id', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/bid', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
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
