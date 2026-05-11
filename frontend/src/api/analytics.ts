import client from './client'

export interface StallionValuation {
  id: string
  name: string
  studFee: number | null
  progenyCount: number
  avgProgenyPrice: number
  medianProgenyPrice: number
  minProgenyPrice: number
  maxProgenyPrice: number
  studFeeToAvgRatio: number | null
}

export interface SaleComparable {
  horseId: string
  horseName: string
  sire: string | null
  saleId: string
  salePrice: number
  saleDate: string
  saleSession: string | null
  sireAvg: number
  sireMedian: number
  sireCount: number
  ratio: number
}

export const getStallionValuations = (): Promise<{ stallions: StallionValuation[] }> =>
  client.get('/api/analytics/valuation/stallions').then((r) => r.data)

export const getSaleComparables = (): Promise<{ comparables: SaleComparable[] }> =>
  client.get('/api/analytics/valuation/comparables').then((r) => r.data)
