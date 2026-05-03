import client from './client'

export interface HeatCycle {
  id: string
  mareId: string
  startDate: string
  notes?: string
  createdAt: string
}

export const getHeatCycles = (mareId: string) =>
  client.get<HeatCycle[]>(`/api/mares/${mareId}/heat-cycles`).then((r) => r.data)

export const addHeatCycle = (mareId: string, data: { startDate: string; notes?: string }) =>
  client.post<HeatCycle>(`/api/mares/${mareId}/heat-cycles`, data).then((r) => r.data)

export const deleteHeatCycle = (mareId: string, cycleId: string) =>
  client.delete(`/api/mares/${mareId}/heat-cycles/${cycleId}`).then((r) => r.data)
