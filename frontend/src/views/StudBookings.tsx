import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { getMyBookings, completeBreeding } from '@/api/studBookings'
import type { StudBooking } from '@/api/studBookings'
import { toast } from 'sonner'

const STATUS_LABEL: Record<StudBooking['status'], string> = {
  pending_payment: 'Awaiting Payment',
  confirmed: 'Confirmed',
  breeding_complete: 'Breeding Complete',
  cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<StudBooking['status'], string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  breeding_complete: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-stone-100 text-stone-500',
}

function usd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function StudBookings() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['studBookings'], queryFn: getMyBookings })

  useEffect(() => {
    if (params.get('success') === '1') toast.success('Payment confirmed — breeding booked!')
  }, [])

  const completeMutation = useMutation({
    mutationFn: completeBreeding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['studBookings'] })
      toast.success('Breeding marked complete')
    },
    onError: () => toast.error('Failed to update'),
  })

  if (isLoading) return <p className="text-stone-400">Loading…</p>

  const bookings = data?.bookings ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Stud Bookings</h1>
        <Link to="/stallions" className="text-sm text-brand-700 hover:underline">
          Browse Stallions
        </Link>
      </div>

      {bookings.length === 0 && (
        <div className="text-center py-12 text-stone-400">
          <p className="mb-2">No bookings yet.</p>
          <Link to="/stallions" className="text-brand-700 text-sm underline">
            Browse stallions to book a breeding
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white border border-stone-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm">{b.mare.name} × {b.stallion.name}</p>
                <p className="text-xs text-stone-400">
                  {b.stallion.breed} · Fee paid: {usd(b.feePaidCents)}
                  {b.scheduledDate ? ` · ${new Date(b.scheduledDate).toLocaleDateString()}` : ''}
                </p>
                {b.notes && <p className="text-xs text-stone-500 mt-0.5">{b.notes}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLOR[b.status]}`}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>

            {b.completedAt && (
              <p className="text-xs text-stone-400">
                Completed: {new Date(b.completedAt).toLocaleDateString()}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              {b.status === 'confirmed' && (
                <button
                  onClick={() => completeMutation.mutate(b.id)}
                  disabled={completeMutation.isPending}
                  className="text-xs border border-stone-200 px-3 py-1 rounded hover:bg-stone-50 disabled:opacity-50"
                >
                  Mark Breeding Complete
                </button>
              )}
              {b.status === 'breeding_complete' && (
                <Link
                  to="/foals"
                  className="text-xs bg-brand-700 text-white px-3 py-1 rounded hover:bg-brand-900"
                >
                  Record Foal →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
