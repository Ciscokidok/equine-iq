import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, getUserId } from '../middleware/auth'
import { getPresignedUploadUrl } from '../lib/s3Upload'

const router = Router()

// STEP-8: Create listing
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({ horseId: z.string().uuid() })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const userId = getUserId(req)
    const { horseId } = parsed.data

    const horse = await prisma.horse.findFirst({ where: { id: horseId, createdByUser: userId } })
    if (!horse) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const listing = await prisma.auctionListing.create({
      data: { horseId, sellerId: userId, status: 'pending_review' },
    })
    res.status(201).json(listing)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// STEP-27: Seller listings dashboard
router.get('/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req)
    const listings = await prisma.auctionListing.findMany({
      where: { sellerId: userId },
      include: {
        horse: { select: { name: true, breed: true } },
        auction: { include: { _count: { select: { bids: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const result = listings.map((l) => ({
      id: l.id,
      status: l.status,
      horse: l.horse ? { name: l.horse.name, breed: l.horse.breed } : null,
      bidCount: l.auction?._count.bids ?? null,
      currentHighBid: l.auction?.currentBid ?? null,
      createdAt: l.createdAt,
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// STEP-9: Document upload URL
router.post('/:id/documents/upload-url', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      docType: z.enum(['coggins_test', 'vet_certificate', 'registration_papers', 'radiographs', 'endoscopy_video']),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const userId = getUserId(req)
    const { id } = req.params
    const { docType, fileName, mimeType } = parsed.data

    const listing = await prisma.auctionListing.findFirst({ where: { id, sellerId: userId } })
    if (!listing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (listing.status !== 'pending_review') {
      res.status(400).json({ error: 'Documents can only be uploaded when listing is in pending_review status' })
      return
    }

    const { uploadUrl, s3Key } = await getPresignedUploadUrl(id, docType, fileName, mimeType)

    const doc = await prisma.vettingDocument.create({
      data: { listingId: id, docType, s3Key, fileName, mimeType, scanStatus: 'clean' },
    })

    res.json({ uploadUrl, documentId: doc.id })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// STEP-10: Configure listing → create Auction, transition to scheduled
// reservePrice, reserveBehavior, buyersPremiumPct live on AuctionListing
router.post('/:id/configure', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      startAt: z.string().datetime(),
      durationMinutes: z.number().int().positive(),
      startingBid: z.number().int().positive(),
      reservePrice: z.number().int().positive().optional(),
      bidIncrement: z.number().int().positive(),
      reserveBehavior: z.enum(['auto_pass', 'seller_decision', 'counter_offer']).default('auto_pass'),
      buyersPremiumPct: z.number().min(0).max(50).default(10),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const userId = getUserId(req)
    const { id } = req.params
    const { startAt, durationMinutes, startingBid, reservePrice, bidIncrement, reserveBehavior, buyersPremiumPct } = parsed.data

    const listing = await prisma.auctionListing.findFirst({ where: { id, sellerId: userId } })
    if (!listing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (listing.status !== 'approved') {
      res.status(400).json({ error: 'Listing must be in approved status to configure auction' })
      return
    }

    const startDate = new Date(startAt)
    if (startDate <= new Date()) {
      res.status(400).json({ error: 'startAt must be in the future' })
      return
    }

    const endsAt = new Date(startDate.getTime() + durationMinutes * 60 * 1000)

    const [, updated] = await prisma.$transaction([
      prisma.auction.create({
        data: {
          listingId: id,
          status: 'scheduled',
          startAt: startDate,
          endsAt,
          startingBid,
          currentBid: 0,
          bidIncrement,
          auctionSource: 'internal',
        },
      }),
      prisma.auctionListing.update({
        where: { id },
        data: {
          status: 'scheduled',
          reservePrice: reservePrice ?? null,
          reserveBehavior,
          buyersPremiumPct,
        },
      }),
    ])

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Cancel listing — ListingStatus has no 'cancelled'; use 'passed' as closest terminal state
// Stub — returns 501 until the cancel flow is fully designed
router.post('/:id/cancel', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

// STEP-17: Seller accept/decline in seller_decision reserve mode
router.post('/:id/seller-decision', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({ accept: z.boolean() })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const userId = getUserId(req)
    const { id } = req.params
    const { accept } = parsed.data

    const listing = await prisma.auctionListing.findUnique({
      where: { id },
      include: { auction: true },
    })
    if (!listing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (listing.sellerId !== userId) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    if (!listing.auction || listing.auction.status !== 'seller_deciding') {
      res.status(400).json({ error: 'Auction is not in seller_deciding status' })
      return
    }

    const newStatus = accept ? 'sold' : 'passed'
    await prisma.$transaction([
      prisma.auction.update({ where: { id: listing.auction.id }, data: { status: newStatus } }),
      prisma.auctionListing.update({ where: { id }, data: { status: newStatus } }),
    ])

    if (accept) {
      // Invoice notification stub (implemented in STEP-32)
      console.log(`[notify] Listing ${id} seller accepted — send invoice to bidder ${listing.auction.highBidderId}`)
    }

    res.json({ status: newStatus })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
