import client from './client'
import type { Horse } from './mares'

export const getStallions = (params?: Record<string, string>) =>
  client.get<Horse[]>('/api/stallions', { params }).then((r) => r.data)

export const getStallion = (id: string) =>
  client.get<Horse>(`/api/stallions/${id}`).then((r) => r.data)
