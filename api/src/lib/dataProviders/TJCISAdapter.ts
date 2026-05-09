import type { DataProviderAdapter, HorseSearchResult, ProviderSaleRecord } from './types'

export class TJCISAdapter implements DataProviderAdapter {
  constructor(_credential: string) {}

  async testConnection(): Promise<void> {
    throw new Error('TJCIS partnership not active — contact support')
  }

  async search(_query: string): Promise<HorseSearchResult[]> {
    throw new Error('TJCIS partnership not active — contact support')
  }

  async fetchSaleHistory(_providerRef: string): Promise<ProviderSaleRecord[]> {
    throw new Error('TJCIS partnership not active — contact support')
  }
}
