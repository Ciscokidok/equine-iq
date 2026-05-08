import { Router, Request, Response } from 'express'
import { requireAuth, getUserId } from '../middleware/auth'
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

router.post('/:id/watch', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/confirm-payment', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

router.post('/:id/offer-next-bidder', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
