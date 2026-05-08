import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import client from './client'

export interface AuctionSale {
  id: string
  foalId: string
  userId: string
  salePrice: number
  saleDate: string
  saleType: 'weanling' | 'yearling' | 'two_year_old_in_training' | 'mixed_age'
  auctionHouse?: string
  hipNumber?: string
  buyer?: string
  notes?: string
  createdAt: string
}

export interface CreateAuctionSaleData {
  salePrice: number
  saleDate: string
  saleType: 'weanling' | 'yearling' | 'two_year_old_in_training' | 'mixed_age'
  auctionHouse?: string
  hipNumber?: string
  buyer?: string
  notes?: string
}

export interface SaleStats {
  stallionId: string
  mareId: string | null
  count: number
  avg: number | null
  median: number | null
  high: number | null
  low: number | null
  lowSampleWarning: boolean
}

export function useAuctionSales(foalId: string) {
  return useQuery<AuctionSale[]>({
    queryKey: ['auction-sales', foalId],
    queryFn: () => client.get(`/api/foals/${foalId}/auction-sales`).then((r) => r.data),
  })
}

export function useAddAuctionSale() {
  const queryClient = useQueryClient()
  return useMutation<AuctionSale, Error, { foalId: string; data: CreateAuctionSaleData }>({
    mutationFn: ({ foalId, data }) =>
      client.post(`/api/foals/${foalId}/auction-sales`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auction-sales'] })
      toast.success('Sale recorded')
    },
    onError: () => toast.error('Failed to record sale'),
  })
}

export function useStallionSaleStats(stallionId: string, mareId?: string) {
  return useQuery<SaleStats>({
    queryKey: ['stallion-sale-stats', stallionId, mareId],
    queryFn: () =>
      client
        .get(`/api/stallions/${stallionId}/auction-sale-stats`, {
          params: mareId ? { mareId } : {},
        })
        .then((r) => r.data),
    enabled: !!stallionId,
  })
}
