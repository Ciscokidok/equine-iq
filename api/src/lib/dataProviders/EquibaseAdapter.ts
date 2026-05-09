import type { DataProviderAdapter, HorseSearchResult, ProviderSaleRecord } from './types'

// TODO: confirm auth scheme from API docs — may use API key header instead of Bearer
export class EquibaseAdapter implements DataProviderAdapter {
  constructor(private credential: string) {}

  async testConnection(): Promise<void> {
    // Stub — endpoint TBD pending API docs
    return Promise.resolve()
  }

  async search(_query: string): Promise<HorseSearchResult[]> {
    // Stub — implementation pending API docs
    return []
  }

  async fetchSaleHistory(_providerRef: string): Promise<ProviderSaleRecord[]> {
    // Stub — implementation pending API docs
    return []
  }
}
