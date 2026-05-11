import client from './client'

export type BreedingStatus = 'bred' | 'confirmed_in_foal' | 'foaled' | 'slipped' | 'barren'

export interface Breeding {
  id: string
  mareId: string
  stallionId: string
  bredDate: string
  status: BreedingStatus
  studFeeCents: number | null
  confirmedAt: string | null
  expectedFoalDate: string | null
  notes: string | null
  createdAt: string
  mare: { id: string; name: string; color: string | null; dateOfBirth: string | null }
  stallion: { id: string; name: string; studFee: number | null }
  foal: { id: string; name: string | null; sex: string | null; foaledAt: string | null; color: string | null } | null
}

export interface StudBookMare {
  id: string
  name: string
  color: string | null
  dateOfBirth: string | null
  breed: string
  discipline: string
  latestBreeding: {
    id: string
    status: BreedingStatus
    bredDate: string
    stallion: { id: string; name: string }
    studFeeCents: number | null
    confirmedAt: string | null
    expectedFoalDate: string | null
    notes: string | null
    foal: { id: string; name: string | null; sex: string | null; foaledAt: string | null } | null
  } | null
}

export interface StudBookResult {
  mares: StudBookMare[]
  counts: { open: number; bred: number; confirmed_in_foal: number; foaled: number; other: number }
}

export const getStudBook = (): Promise<StudBookResult> =>
  client.get('/api/breedings/stud-book').then((r) => r.data)

export const getBreedings = (): Promise<{ breedings: Breeding[] }> =>
  client.get('/api/breedings').then((r) => r.data)

export const recordBreeding = (data: {
  mareId: string; stallionId: string; bredDate: string
  studFeeCents?: number; expectedFoalDate?: string; notes?: string
}): Promise<{ breeding: Breeding }> =>
  client.post('/api/breedings', data).then((r) => r.data)

export const updateBreeding = (id: string, data: Partial<{
  status: BreedingStatus; confirmedAt: string; expectedFoalDate: string
  studFeeCents: number; notes: string
}>): Promise<{ breeding: Breeding }> =>
  client.patch(`/api/breedings/${id}`, data).then((r) => r.data)

export const recordFoal = (breedingId: string, data: {
  foaledAt: string; name?: string; sex?: string; color?: string; notes?: string
}): Promise<{ foal: { id: string } }> =>
  client.post(`/api/breedings/${breedingId}/foal`, data).then((r) => r.data)

export const deleteBreeding = (id: string): Promise<{ ok: boolean }> =>
  client.delete(`/api/breedings/${id}`).then((r) => r.data)
