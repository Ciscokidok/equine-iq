export type DataProvider = 'sporthorse_data' | 'equibase' | 'tjcis'

export interface HorseSearchResult {
  name: string
  sire?: string
  dam?: string
  dateOfBirth?: string
  registrationNumber?: string
  providerRef: string
}

export interface ProviderSaleRecord {
  providerRef: string
  saleDate: string
  saleSessionName?: string
  hipNumber?: string
  hammerPriceCents: number
  buyerName?: string
  consignorName?: string
}

export interface DataProviderAdapter {
  testConnection(): Promise<void>
  search(query: string): Promise<HorseSearchResult[]>
  fetchSaleHistory(providerRef: string): Promise<ProviderSaleRecord[]>
}
