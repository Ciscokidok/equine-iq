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
