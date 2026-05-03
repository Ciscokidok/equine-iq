import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMare } from '@/api/mares'
import { getHeatCycles, addHeatCycle, deleteHeatCycle } from '@/api/heatCycles'
import type { HeatCycle } from '@/api/heatCycles'
import { toast } from 'sonner'

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function getDayColor(day: Date, cycles: HeatCycle[]): string {
  for (const cycle of cycles) {
    const start = new Date(cycle.startDate)
    for (let i = 0; i < 5; i++) {
      if (isSameDay(day, addDays(cycle.startDate, i))) return 'bg-blue-200 text-blue-900 font-semibold'
    }
    for (let i = 13; i < 16; i++) {
      if (isSameDay(day, addDays(cycle.startDate, i))) return 'bg-green-200 text-green-900 font-semibold'
    }
    for (let i = 16; i < 21; i++) {
      if (isSameDay(day, addDays(cycle.startDate, i))) return 'bg-yellow-200 text-yellow-900 font-semibold'
    }
  }
  return ''
}

function MonthCalendar({ year, month, cycles }: { year: number; month: number; cycles: HeatCycle[] }) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 0=Sun, adjust to Mon-start
  const startDow = (firstDay.getDay() + 6) % 7
  const days: Array<Date | null> = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))

  const weeks: Array<Array<Date | null>> = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  const today = new Date()
  const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <p className="text-sm font-semibold mb-3">{MONTH_NAMES[month]} {year}</p>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-stone-400 py-1">{d}</div>
        ))}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return <div key={`e-${wi}-${di}`} />
            const color = getDayColor(day, cycles)
            const isToday = isSameDay(day, today)
            return (
              <div
                key={day.toISOString()}
                className={`text-center py-1.5 rounded ${color || 'text-stone-700'} ${isToday ? 'ring-1 ring-brand-700' : ''}`}
              >
                {day.getDate()}
              </div>
            )
          })
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 inline-block" /> In heat (days 1–5)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 inline-block" /> Optimal (days 14–16)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200 inline-block" /> Approaching (days 17–21)</span>
      </div>
    </div>
  )
}

export default function HeatCycleView() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [notes, setNotes] = useState('')

  const { data: mare } = useQuery({ queryKey: ['mare', id], queryFn: () => getMare(id!) })
  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['heat-cycles', id],
    queryFn: () => getHeatCycles(id!),
  })

  const addMutation = useMutation({
    mutationFn: () => addHeatCycle(id!, { startDate, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['heat-cycles', id] })
      toast.success('Heat cycle logged')
      setStartDate('')
      setNotes('')
      setShowForm(false)
    },
    onError: () => toast.error('Failed to log cycle'),
  })

  const deleteMutation = useMutation({
    mutationFn: (cycleId: string) => deleteHeatCycle(id!, cycleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['heat-cycles', id] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Delete failed'),
  })

  const now = new Date()
  const mostRecent = cycles.length
    ? cycles.reduce((a, b) => (a.startDate > b.startDate ? a : b))
    : null
  const nextPredicted = mostRecent ? addDays(mostRecent.startDate, 21) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/mares/${id}`} className="text-sm text-stone-500 hover:text-stone-900">
            ← Back to Profile
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{mare?.name ?? '…'}</h1>
            <p className="text-stone-500 text-sm">Heat Cycle Tracker</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900"
        >
          {showForm ? 'Cancel' : 'Log Heat Cycle'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Log New Heat Cycle</h2>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="Optional observations…"
            />
          </div>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!startDate || addMutation.isPending}
            className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {nextPredicted && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-green-800">Next predicted cycle: </span>
          <span className="text-green-700">
            {nextPredicted.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="text-green-600 text-xs ml-2">(based on 21-day average)</span>
        </div>
      )}

      <MonthCalendar year={now.getFullYear()} month={now.getMonth()} cycles={cycles} />

      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}

      {cycles.length === 0 && !isLoading && (
        <p className="text-stone-400 text-sm">No cycles logged yet. Log a heat cycle to begin tracking.</p>
      )}

      {cycles.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Logged Cycles</h2>
          <div className="space-y-2">
            {[...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((cycle) => (
              <div key={cycle.id} className="flex items-start justify-between border-t border-stone-100 pt-2 first:border-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(cycle.startDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  {cycle.notes && <p className="text-xs text-stone-400">{cycle.notes}</p>}
                  <p className="text-xs text-stone-300 mt-0.5">
                    Optimal window: {addDays(cycle.startDate, 13).toLocaleDateString()} – {addDays(cycle.startDate, 15).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(cycle.id)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
