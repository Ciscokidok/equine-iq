import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import client from '@/api/client'
import type { Horse } from '@/api/mares'

const DISCIPLINES = ['','sport_horse','warmblood','quarter_horse','paint','reining','cutting','barrel_racing','hunter_jumper','dressage','eventing','other']

export default function StallionCatalog() {
  const [discipline, setDiscipline] = useState('')
  const [q, setQ] = useState('')
  const [maxFee, setMaxFee] = useState('')

  const { data: stallions = [], isLoading } = useQuery({
    queryKey: ['stallions', discipline, q, maxFee],
    queryFn: () => {
      const params = new URLSearchParams()
      if (discipline) params.set('discipline', discipline)
      if (q) params.set('q', q)
      if (maxFee) params.set('maxFee', maxFee)
      return client.get<Horse[]>(`/api/stallions?${params}`).then(r => r.data)
    },
  })

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Stallion Catalog</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input w-48"
          placeholder="Search name…"
        />
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="input">
          {DISCIPLINES.map(d => (
            <option key={d} value={d}>{d ? d.replace(/_/g, ' ') : 'All disciplines'}</option>
          ))}
        </select>
        <input
          type="number"
          value={maxFee}
          onChange={(e) => setMaxFee(e.target.value)}
          className="input w-36"
          placeholder="Max fee $"
        />
      </div>

      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stallions.map((s) => (
          <div key={s.id} className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="font-semibold">{s.name}</p>
            <p className="text-xs text-stone-400 mb-2">{s.breed} · {s.discipline.replace(/_/g, ' ')}</p>
            {s.studFee && <p className="text-sm text-stone-600">${s.studFee.toLocaleString()}</p>}
            {s.studLocation && <p className="text-xs text-stone-400">{s.studLocation}</p>}
            {s.offspringCount > 0 && (
              <p className="text-xs text-stone-400 mt-1">{s.offspringCount} offspring</p>
            )}
            {!s.offspringPerformanceSummary && (
              <p className="text-xs text-stone-300 italic mt-1">Insufficient data for AI analysis</p>
            )}
          </div>
        ))}
        {!isLoading && stallions.length === 0 && (
          <p className="col-span-3 text-sm text-stone-400 py-4">No stallions match filters.</p>
        )}
      </div>
    </div>
  )
}
