import client from './client'

export interface FoalResult {
  id: string
  foalId: string
  event: string
  eventDate: string
  placement?: string
  score?: number
  earnings?: number
  notes?: string
  createdAt: string
}

export interface Foal {
  id: string
  name?: string
  sex?: string
  foaledAt?: string
  color?: string
  notes?: string
  mareId: string
  stallionId?: string
  pairingId?: string
  userId: string
  createdAt: string
  mare: { id: string; name: string; breed: string }
  stallion?: { id: string; name: string; breed: string }
  results: FoalResult[]
}

export interface CreateFoalData {
  mareId: string
  name?: string
  sex?: string
  foaledAt?: string
  color?: string
  notes?: string
  stallionId?: string
  pairingId?: string
}

export interface CreateFoalResultData {
  event: string
  eventDate: string
  placement?: string
  score?: number
  earnings?: number
  notes?: string
}

export const getFoals = () => client.get<Foal[]>('/api/foals').then((r) => r.data)
export const getFoal = (id: string) => client.get<Foal>(`/api/foals/${id}`).then((r) => r.data)
export const createFoal = (data: CreateFoalData) => client.post<Foal>('/api/foals', data).then((r) => r.data)
export const updateFoal = (id: string, data: Partial<CreateFoalData>) =>
  client.put<Foal>(`/api/foals/${id}`, data).then((r) => r.data)
export const deleteFoal = (id: string) => client.delete(`/api/foals/${id}`).then((r) => r.data)
export const addFoalResult = (foalId: string, data: CreateFoalResultData) =>
  client.post<FoalResult>(`/api/foals/${foalId}/results`, data).then((r) => r.data)
