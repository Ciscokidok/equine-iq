import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()
router.use(requireAuth, requireAdmin)

const REQUIRED_DOCS = ['coggins_test', 'vet_certificate', 'registration_papers']

const userSelect = { id: true, email: true, farmName: true }

router.get('/', async (_req: Request, res: Response) => {
  const [
    confirmed,
    breedingComplete,
    foalsRecorded,
    listingsRaw,
    approved,
    live,
  ] = await Promise.all([
    prisma.studBooking.findMany({
      where: { status: 'confirmed' },
      include: {
        mare: { select: { id: true, name: true, breed: true } },
        stallion: { select: { id: true, name: true } },
        user: { select: userSelect },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.studBooking.findMany({
      where: { status: 'breeding_complete' },
      include: {
        mare: { select: { id: true, name: true, breed: true } },
        stallion: { select: { id: true, name: true } },
        user: { select: userSelect },
      },
      orderBy: { completedAt: 'asc' },
    }),

    prisma.foal.findMany({
      where: { promotedHorseId: null },
      include: {
        mare: { select: { id: true, name: true } },
        stallion: { select: { id: true, name: true } },
        user: { select: userSelect },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.auctionListing.findMany({
      where: { status: 'pending_review' },
      include: {
        horse: { select: { id: true, name: true, breed: true } },
        seller: { select: userSelect },
        vettingDocuments: { select: { docType: true, scanStatus: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.auctionListing.findMany({
      where: { status: 'approved' },
      include: {
        horse: { select: { id: true, name: true, breed: true } },
        seller: { select: userSelect },
      },
      orderBy: { vetApprovedAt: 'asc' },
    }),

    prisma.auction.findMany({
      where: { status: { in: ['open', 'scheduled'] } },
      include: {
        listing: {
          include: {
            horse: { select: { id: true, name: true } },
            seller: { select: userSelect },
          },
        },
      },
      orderBy: { startAt: 'asc' },
    }),
  ])

  const listingInProgress = listingsRaw
    .map((l) => {
      const cleanDocs = l.vettingDocuments
        .filter((d) => d.scanStatus === 'clean')
        .map((d) => d.docType)
      const missingDocTypes = REQUIRED_DOCS.filter((t) => !cleanDocs.includes(t as any))
      return { ...l, uploadedDocTypes: cleanDocs, missingDocTypes }
    })
    .filter((l) => l.missingDocTypes.length > 0)

  const vettingQueue = listingsRaw.filter((l) => {
    const cleanDocs = l.vettingDocuments
      .filter((d) => d.scanStatus === 'clean')
      .map((d) => d.docType)
    return REQUIRED_DOCS.every((t) => cleanDocs.includes(t as any))
  })

  res.json({
    stages: {
      breeding_confirmed: confirmed,
      breeding_complete: breedingComplete,
      foal_recorded: foalsRecorded,
      listing_in_progress: listingInProgress,
      vetting_queue: vettingQueue,
      approved,
      live,
    },
  })
})

export default router
