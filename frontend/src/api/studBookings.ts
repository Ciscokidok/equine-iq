import client from './client'

export interface StudBooking {
  id: string
  mareId: string
  stallionId: string
  feePaidCents: number
  status: 'pending_payment' | 'confirmed' | 'breeding_complete' | 'cancelled'
  scheduledDate: string | null
  completedAt: string | null
  notes: string | null
  createdAt: string
  mare: { id: string; name: string; breed: string }
  stallion: { id: string; name: string; breed: string; studFee: number | null }
}

export const createBooking = (payload: {
  mareId: string
  stallionId: string
  scheduledDate?: string
  notes?: string
}): Promise<{ bookingId: string; checkoutUrl: string | null; booking?: StudBooking }> =>
  client.post('/api/stud-bookings', payload).then((r) => r.data)

export const getMyBookings = (): Promise<{ bookings: StudBooking[] }> =>
  client.get('/api/stud-bookings/mine').then((r) => r.data)

export const completeBreeding = (id: string): Promise<StudBooking> =>
  client.post(`/api/stud-bookings/${id}/complete`).then((r) => r.data)

export const promoteToHorse = (foalId: string): Promise<{ horseId: string; alreadyPromoted: boolean }> =>
  client.post(`/api/foals/${foalId}/promote`).then((r) => r.data)
