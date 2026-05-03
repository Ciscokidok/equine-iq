import client from './client'

export interface PedigreeResponse {
  horse: { id: string; name: string; sex: string; breed: string }
  pedigree: Record<string, { name?: string; breed?: string }>
  inbreeding_flags: Array<{ name: string; count: number; severity: string }>
}

export const getHorsePedigree = (id: string) =>
  client.get<PedigreeResponse>(`/api/horses/${id}/pedigree`).then((r) => r.data)
