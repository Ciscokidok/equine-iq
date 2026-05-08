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

// GET /mine — STEP-27 (stub)
router.get('/mine', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
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

// STEP-17: Seller decision (stub — implemented in Bundle 5)
router.post('/:id/seller-decision', requireAuth, (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Not implemented' })
})

export default router
