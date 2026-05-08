import { prisma } from './prisma'
import { getIO } from './auctionSocket'

function tryBroadcast(auctionId: string, status: string): void {
  try {
    getIO().to(`auction:${auctionId}`).emit('status', { status })
  } catch (e) {
    console.error(`[lifecycle] broadcast failed auction ${auctionId}`, e)
  }
}

export async function transitionToOpen(): Promise<void> {
  const now = new Date()
  const candidates = await prisma.auction.findMany({
    where: { status: 'scheduled', startAt: { lte: now } },
    select: { id: true },
  })
  if (candidates.length === 0) return

  await prisma.auction.updateMany({
    where: { status: 'scheduled', startAt: { lte: now } },
    data: { status: 'open' },
  })

  for (const { id } of candidates) tryBroadcast(id, 'open')
}

export async function evaluateReserve(auctionId: string): Promise<void> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { listing: true },
  })
  if (!auction) return

  const { reservePrice, reserveBehavior } = auction.listing
  const reserveMet = reservePrice === null || auction.currentBid >= reservePrice

  if (reserveMet) {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'sold' } })
    await prisma.auctionListing.update({ where: { id: auction.listingId }, data: { status: 'sold' } })
    tryBroadcast(auctionId, 'sold')
    return
  }

  if (reserveBehavior === 'auto_pass') {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'passed' } })
    await prisma.auctionListing.update({ where: { id: auction.listingId }, data: { status: 'passed' } })
    tryBroadcast(auctionId, 'passed')
  } else if (reserveBehavior === 'seller_decision') {
    const deadline = new Date((auction.closedAt ?? new Date()).getTime() + 24 * 60 * 60 * 1000)
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'seller_deciding', sellerDecisionDeadline: deadline },
    })
    await prisma.auctionListing.update({ where: { id: auction.listingId }, data: { status: 'seller_deciding' } })
    tryBroadcast(auctionId, 'seller_deciding')
  } else if (reserveBehavior === 'counter_offer') {
    await prisma.auction.update({ where: { id: auctionId }, data: { status: 'counter_offering' } })
    await prisma.auctionListing.update({ where: { id: auction.listingId }, data: { status: 'counter_offering' } })
    tryBroadcast(auctionId, 'counter_offering')
  }
}

export async function transitionToClosed(): Promise<void> {
  const now = new Date()
  const candidates = await prisma.auction.findMany({
    where: { status: 'open', endsAt: { lte: now } },
    select: { id: true },
  })
  if (candidates.length === 0) return

  await prisma.auction.updateMany({
    where: { status: 'open', endsAt: { lte: now } },
    data: { status: 'closed', closedAt: now },
  })

  for (const { id } of candidates) {
    try {
      await evaluateReserve(id)
    } catch (e) {
      console.error(`[lifecycle] evaluateReserve failed auction ${id}`, e)
    }
  }
}

export async function checkSellerDecisionExpiry(): Promise<void> {
  const now = new Date()
  const candidates = await prisma.auction.findMany({
    where: { status: 'seller_deciding', sellerDecisionDeadline: { lte: now } },
    select: { id: true, listingId: true },
  })
  if (candidates.length === 0) return

  await prisma.auction.updateMany({
    where: { status: 'seller_deciding', sellerDecisionDeadline: { lte: now } },
    data: { status: 'passed' },
  })

  for (const { id, listingId } of candidates) {
    try {
      await prisma.auctionListing.update({ where: { id: listingId }, data: { status: 'passed' } })
      tryBroadcast(id, 'passed')
    } catch (e) {
      console.error(`[lifecycle] seller_deciding expiry failed auction ${id}`, e)
    }
  }
}

export async function cronTick(): Promise<void> {
  try { await transitionToOpen() } catch (e) { console.error('[lifecycle] transitionToOpen failed', e) }
  try { await transitionToClosed() } catch (e) { console.error('[lifecycle] transitionToClosed failed', e) }
  try { await checkSellerDecisionExpiry() } catch (e) { console.error('[lifecycle] checkSellerDecisionExpiry failed', e) }
}
