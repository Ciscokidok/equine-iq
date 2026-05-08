import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from './client'

export interface AuctionListing {
  id: string
  horseId: string
  sellerId: string
  status: 'pending_review' | 'approved' | 'scheduled' | 'sold' | 'passed' | 'rejected'
  vetApprovedAt?: string
  vetRejectedAt?: string
  vetRejectedReason?: string
  reservePrice?: number
  reserveBehavior?: 'auto_pass' | 'seller_decision' | 'counter_offer'
  buyersPremiumPct?: number
  createdAt: string
}

export interface ConfigureListingData {
  startAt: string
  durationMinutes: number
  startingBid: number
  reservePrice?: number
  bidIncrement: number
  reserveBehavior?: 'auto_pass' | 'seller_decision' | 'counter_offer'
  buyersPremiumPct?: number
}

export interface UploadUrlResponse {
  uploadUrl: string
  documentId: string
}

export const useCreateListing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (horseId: string) =>
      client.post<AuctionListing>('/api/listings', { horseId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myListings'] }),
  })
}

export const useMyListings = () =>
  useQuery({
    queryKey: ['myListings'],
    queryFn: () => client.get<AuctionListing[]>('/api/listings/mine').then((r) => r.data),
  })

export const useRequestUploadUrl = () =>
  useMutation({
    mutationFn: ({
      listingId,
      docType,
      fileName,
      mimeType,
    }: {
      listingId: string
      docType: string
      fileName: string
      mimeType: string
    }) =>
      client
        .post<UploadUrlResponse>(`/api/listings/${listingId}/documents/upload-url`, {
          docType,
          fileName,
          mimeType,
        })
        .then((r) => r.data),
  })

export const useConfigureListing = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ listingId, data }: { listingId: string; data: ConfigureListingData }) =>
      client
        .post<AuctionListing>(`/api/listings/${listingId}/configure`, data)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myListings'] }),
  })
}

// Admin: vetting queue
export const useVettingQueue = () =>
  useQuery({
    queryKey: ['vetting-queue'],
    queryFn: () => client.get('/api/admin/vetting/queue').then((r) => r.data),
  })

export const useApproveVetting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.post(`/api/admin/vetting/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vetting-queue'] }),
  })
}

export const useRejectVetting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      client.post(`/api/admin/vetting/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vetting-queue'] }),
  })
}

// Admin: bidder approval
export const usePendingBidders = () =>
  useQuery({
    queryKey: ['pending-bidders'],
    queryFn: () => client.get('/api/admin/bidders/pending').then((r) => r.data),
  })

export const useApproveBidder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.post(`/api/admin/bidders/${id}/approve`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-bidders'] }),
  })
}

export const useSuspendBidder = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client.post(`/api/admin/bidders/${id}/suspend`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-bidders'] }),
  })
}

export const useConfirmDeposit = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      client.patch(`/api/admin/bidders/${id}/deposit-confirmed`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-bidders'] }),
  })
}

// Catalog
export interface AuctionCatalogItem {
  id: string
  status: string
  currentBid: number
  startingBid: number
  bidIncrement: number
  buyersPremiumPct: number | null
  startAt: string
  endsAt: string
  horse: { name: string; breed: string; discipline: string } | null
  photoUrl: string | null
}

export interface AuctionCatalogFilters {
  breed?: string
  discipline?: string
  status?: string
  minPrice?: number
  maxPrice?: number
}

export const useAuctionCatalog = (filters: AuctionCatalogFilters = {}) =>
  useQuery({
    queryKey: ['auction-catalog', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.breed) params.set('breed', filters.breed)
      if (filters.discipline) params.set('discipline', filters.discipline)
      if (filters.status) params.set('status', filters.status)
      if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice))
      if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice))
      const qs = params.toString()
      return client.get<AuctionCatalogItem[]>(`/api/auctions/catalog${qs ? `?${qs}` : ''}`).then((r) => r.data)
    },
  })

// Seller dashboard
export interface MyListingItem {
  id: string
  status: string
  horse: { name: string; breed: string } | null
  bidCount: number | null
  currentHighBid: number | null
  createdAt: string
}

export const useMyListingItems = () =>
  useQuery({
    queryKey: ['myListingItems'],
    queryFn: () => client.get<MyListingItem[]>('/api/listings/mine').then((r) => r.data),
  })

// Buyer dashboard
export interface MyBidItem {
  auctionId: string
  horseName: string | null
  bidStatus: 'winning' | 'won' | 'outbid' | 'closed'
  currentBid: number
  auctionStatus: string
}

export interface AutoBidEntry {
  auctionId: string
  autoMaxAmount: number | null
  currentBid: number
}

export const useMyBids = () =>
  useQuery({
    queryKey: ['my-bids'],
    queryFn: () =>
      client.get<{ bids: MyBidItem[]; autoBids: AutoBidEntry[] }>('/api/auctions/my-bids').then((r) => r.data),
  })
