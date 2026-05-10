import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()

router.use(requireAuth, requireAdmin)

const REQUIRED_DOC_TYPES = ['coggins_test', 'vet_certificate', 'registration_papers', 'bill_of_sale', 'ownership_transfer']

// GET /queue — listings in pending_review with all 3 required docs scanned clean
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const listings = await prisma.auctionListing.findMany({
      where: { status: 'pending_review' },
      include: {
        vettingDocuments: { where: { scanStatus: 'clean' } },
        horse: true,
      },
    })

    const ready = listings.filter((l) => {
      const docTypes = l.vettingDocuments.map((d) => d.docType)
      return REQUIRED_DOC_TYPES.every((t) => docTypes.includes(t as any))
    })

    res.json(ready)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /:id/approve
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const listing = await prisma.auctionListing.findUnique({ where: { id } })
    if (!listing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    // Idempotent — already approved
    if (listing.status === 'approved') {
      res.json(listing)
      return
    }
    if (listing.status !== 'pending_review') {
      res.status(400).json({ error: 'Listing is not in pending_review status' })
      return
    }

    const updated = await prisma.auctionListing.update({
      where: { id },
      data: { status: 'approved', vetApprovedAt: new Date() },
    })

    // Seller notification stub (implemented in STEP-39)
    console.log(`[notify] Listing ${id} approved — notify seller ${listing.sellerId}`)

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /:id/reject
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ reason: z.string().min(1) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() })
      return
    }
    const { id } = req.params
    const { reason } = parsed.data

    const listing = await prisma.auctionListing.findUnique({ where: { id } })
    if (!listing) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    // Idempotent — already rejected
    if (listing.status === 'rejected') {
      res.json(listing)
      return
    }
    if (listing.status !== 'pending_review') {
      res.status(400).json({ error: 'Listing is not in pending_review status' })
      return
    }

    const updated = await prisma.auctionListing.update({
      where: { id },
      data: { status: 'rejected', vetRejectedAt: new Date(), vetRejectedReason: reason },
    })

    // Seller notification stub (implemented in STEP-39)
    console.log(`[notify] Listing ${id} rejected — notify seller ${listing.sellerId}`)

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
