import { Router, Request, Response } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'
import { requireAdmin } from '../../middleware/admin'

const router = Router()
router.use(requireAuth, requireAdmin)

const REQUIRED_DOCS = ['coggins_test', 'vet_certificate', 'registration_papers']

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
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.studBooking.findMany({
      where: { status: 'breeding_complete' },
      include: {
        mare: { select: { id: true, name: true, breed: true } },
        stallion: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { completedAt: 'asc' },
    }),

    prisma.foal.findMany({
      where: { promotedHorseId: null },
      include: {
        mare: { select: { id: true, name: true } },
        stallion: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.auctionListing.findMany({
      where: { status: { in: ['draft', 'pending_review'] } },
      include: {
        horse: { select: { id: true, name: true, breed: true } },
        seller: { select: { id: true, email: true, name: true } },
        vettingDocuments: { select: { docType: true, scanStatus: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.auctionListing.findMany({
      where: { status: 'approved' },
      include: {
        horse: { select: { id: true, name: true, breed: true } },
        seller: { select: { id: true, email: true, name: true } },
      },
      orderBy: { vetApprovedAt: 'asc' },
    }),

    prisma.auction.findMany({
      where: { status: { in: ['open', 'scheduled'] } },
      include: {
        listing: {
          include: {
            horse: { select: { id: true, name: true } },
            seller: { select: { id: true, email: true, name: true } },
          },
        },
      },
      orderBy: { startAt: 'asc' },
    }),
  ])

  const docsUploaded = listingsRaw.filter((l) => {
    const cleanDocs = l.vettingDocuments.filter((d) => d.scanStatus === 'clean').map((d) => d.docType)
    return REQUIRED_DOCS.every((t) => cleanDocs.includes(t as any))
  })
  const docsIncomplete = listingsRaw.filter((l) => {
    const cleanDocs = l.vettingDocuments.filter((d) => d.scanStatus === 'clean').map((d) => d.docType)
    return !REQUIRED_DOCS.every((t) => cleanDocs.includes(t as any))
  })

  res.json({
    stages: {
      breeding_confirmed: confirmed,
      breeding_complete: breedingComplete,
      foal_recorded: foalsRecorded,
      listing_in_progress: docsIncomplete.map((l) => ({
        ...l,
        uploadedDocTypes: l.vettingDocuments.filter((d) => d.scanStatus === 'clean').map((d) => d.docType),
        missingDocTypes: REQUIRED_DOCS.filter((t) => !l.vettingDocuments.filter((d) => d.scanStatus === 'clean').map((d) => d.docType).includes(t as any)),
      })),
      vetting_queue: docsUploaded,
      approved: approved,
      live: live,
    },
  })
})

export default router
