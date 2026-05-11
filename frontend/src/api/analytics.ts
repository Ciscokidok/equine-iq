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

export interface PinhookHorse {
  horseId: string
  horseName: string
  sire: string | null
  saleCount: number
  firstPrice: number
  lastPrice: number
  roiPct: number | null
  priceDelta: number
  sales: Array<{ price: number; date: string; session: string | null }>
}

export interface ConsignorStat {
  consignor: string
  saleCount: number
  avgPrice: number
  medianPrice: number
  totalVolume: number
  beatsSireAvg: number
  avgVsSirePct: number | null
}

export interface RacingEarnings {
  id: string
  horseId: string
  totalEarningsCents: number
  starts: number | null
  wins: number | null
  places: number | null
  shows: number | null
  bestRaceClass: string | null
  notes: string | null
  sourceUrl: string | null
  updatedAt: string
}

export interface ProductionCost {
  id: string
  horseId: string
  category: string
  amountCents: number
  year: number
  notes: string | null
  createdAt: string
}

export const getStallionValuations = (): Promise<{ stallions: StallionValuation[] }> =>
  client.get('/api/analytics/valuation/stallions').then((r) => r.data)

export const getSaleComparables = (): Promise<{ comparables: SaleComparable[] }> =>
  client.get('/api/analytics/valuation/comparables').then((r) => r.data)

export const getPinhooking = (): Promise<{ horses: PinhookHorse[] }> =>
  client.get('/api/analytics/valuation/pinhooking').then((r) => r.data)

export const getConsignors = (): Promise<{ consignors: ConsignorStat[] }> =>
  client.get('/api/analytics/valuation/consignors').then((r) => r.data)

export const getRacingEarnings = (horseId: string): Promise<{ earnings: RacingEarnings | null }> =>
  client.get(`/api/analytics/racing-earnings/${horseId}`).then((r) => r.data)

export const saveRacingEarnings = (horseId: string, data: Partial<RacingEarnings>): Promise<{ earnings: RacingEarnings }> =>
  client.put(`/api/analytics/racing-earnings/${horseId}`, data).then((r) => r.data)

export const getProductionCosts = (horseId: string): Promise<{ costs: ProductionCost[]; totalCents: number }> =>
  client.get(`/api/analytics/production-costs/${horseId}`).then((r) => r.data)

export const addProductionCost = (horseId: string, data: { category: string; amountCents: number; year: number; notes?: string }): Promise<{ cost: ProductionCost }> =>
  client.post(`/api/analytics/production-costs/${horseId}`, data).then((r) => r.data)

export const deleteProductionCost = (costId: string): Promise<{ ok: boolean }> =>
  client.delete(`/api/analytics/production-costs/entry/${costId}`).then((r) => r.data)
