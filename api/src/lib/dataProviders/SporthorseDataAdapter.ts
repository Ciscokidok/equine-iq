import type { DataProviderAdapter, HorseSearchResult, ProviderSaleRecord } from './types'

export class SporthorseDataAdapter implements DataProviderAdapter {
  constructor(private credential: string) {}

  async testConnection(): Promise<void> {
    const res = await fetch('https://api.sporthorsedata.com/v1/health', {
      headers: { Authorization: `Bearer ${this.credential}` },
    })
    if (!res.ok) throw new Error(`SporthorseData connection failed: ${res.status}`)
  }

  async search(query: string): Promise<HorseSearchResult[]> {
    const res = await fetch(
      `https://api.sporthorsedata.com/v1/horses/search?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${this.credential}` } }
    )
    if (!res.ok) throw new Error(`SporthorseData search failed: ${res.status}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    return (data.results ?? []).map((r: any) => ({
      name: r.name,
      sire: r.sire,
      dam: r.dam,
      dateOfBirth: r.dateOfBirth,
      registrationNumber: r.registrationNumber,
      providerRef: r.id,
    }))
  }

  async fetchSaleHistory(providerRef: string): Promise<ProviderSaleRecord[]> {
    const res = await fetch(
      `https://api.sporthorsedata.com/v1/horses/${providerRef}/sales`,
      { headers: { Authorization: `Bearer ${this.credential}` } }
    )
    if (!res.ok) throw new Error(`SporthorseData fetchSaleHistory failed: ${res.status}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    return (data.sales ?? []).map((s: any) => ({
      providerRef: s.id,
      saleDate: s.saleDate,
      saleSessionName: s.sessionName,
      hipNumber: s.hipNumber,
      hammerPriceCents: Math.round((s.price ?? 0) * 100),
      buyerName: s.buyer,
      consignorName: s.consignor,
    }))
  }
}
