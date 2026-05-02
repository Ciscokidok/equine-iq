import client from './client'

export interface Horse {
  id: string
  name: string
  sex: string
  breed: string
  discipline: string
  dateOfBirth?: string
  color?: string
  heightHands?: number
  conformationNotes?: string
  performanceRecords: Array<{ event: string; date: string; placement?: string; score?: number }>
  pedigree: Record<string, any>
  studFee?: number
  studLocation?: string
  offspringCount: number
  offspringPerformanceSummary?: string
  createdAt: string
}

export const getMares = () => client.get<Horse[]>('/api/mares').then(r => r.data)
export const getMare = (id: string) => client.get<Horse>(`/api/mares/${id}`).then(r => r.data)
export const createMare = (data: Partial<Horse>) => client.post<Horse>('/api/mares', data).then(r => r.data)
export const updateMare = (id: string, data: Partial<Horse>) => client.put<Horse>(`/api/mares/${id}`, data).then(r => r.data)
export const deleteMare = (id: string) => client.delete(`/api/mares/${id}`).then(r => r.data)
