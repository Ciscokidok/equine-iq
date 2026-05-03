import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '@/api/client'
import type { Horse } from '@/api/mares'

const DISCIPLINES = ['','sport_horse','warmblood','quarter_horse','paint','reining','cutting','barrel_racing','flat_racing','thoroughbred_racing','hunter_jumper','dressage','eventing','other']

type SortKey = 'offspringCount' | 'studFee' | 'name'

function sortStallions(stallions: Horse[], sort: SortKey): Horse[] {
  return [...stallions].sort((a, b) => {
    if (sort === 'offspringCount') return (b.offspringCount ?? 0) - (a.offspringCount ?? 0)
    if (sort === 'studFee') return (a.studFee ?? Infinity) - (b.studFee ?? Infinity)
    return a.name.localeCompare(b.name)
  })
}

export default function StallionCatalog() {
  const navigate = useNavigate()
  const [discipline, setDiscipline] = useState('')
  const [q, setQ] = useState('')
  const [maxFee, setMaxFee] = useState('')
  const [sort, setSort] = useState<SortKey>('offspringCount')
  const [compareIds, setCompareIds] = useState<string[]>([])

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ['stallions', discipline, q, maxFee],
    queryFn: () => {
      const params = new URLSearchParams()
      if (discipline) params.set('discipline', discipline)
      if (q) params.set('q', q)
      if (maxFee) params.set('maxFee', maxFee)
      return client.get<Horse[]>(`/api/stallions?${params}`).then(r => r.data)
    },
  })

  const stallions = sortStallions(raw, sort)

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev,
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Stallion Catalog</h1>
        {compareIds.length >= 2 && (
          <button
            onClick={() => navigate(`/stallions/compare?ids=${compareIds.join(',')}`)}
            className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900"
          >
            Compare {compareIds.length} Stallions →
          </button>
        )}
      </div>

      {/* Filters + sort */}
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
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input">
          <option value="offspringCount">Offspring Count (desc)</option>
          <option value="studFee">Stud Fee (asc)</option>
          <option value="name">Name (A–Z)</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stallions.map((s) => (
          <div key={s.id} className="bg-white border border-stone-200 rounded-lg p-4 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{s.name}</p>
                <p className="text-xs text-stone-400">{s.breed} · {s.discipline.replace(/_/g, ' ')}</p>
              </div>
              <input
                type="checkbox"
                checked={compareIds.includes(s.id)}
                onChange={() => toggleCompare(s.id)}
                disabled={!compareIds.includes(s.id) && compareIds.length >= 4}
                className="w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0"
                title="Select to compare"
              />
            </div>
            {s.studFee && <p className="text-sm text-stone-600">${s.studFee.toLocaleString()}</p>}
            {s.studLocation && <p className="text-xs text-stone-400">{s.studLocation}</p>}
            {s.offspringCount > 0 && (
              <p className="text-xs text-stone-400">{s.offspringCount} offspring</p>
            )}
            {!s.offspringPerformanceSummary && (
              <p className="text-xs text-stone-300 italic">Insufficient data for AI analysis</p>
            )}
            <div className="mt-2 flex gap-2">
              <Link
                to={`/stallions/${s.id}`}
                className="text-xs border border-stone-200 px-2 py-1 rounded hover:bg-stone-50"
              >
                Details →
              </Link>
              <Link
                to={`/horses/${s.id}/pedigree`}
                className="text-xs border border-stone-200 px-2 py-1 rounded hover:bg-stone-50"
              >
                Pedigree
              </Link>
            </div>
          </div>
        ))}
        {!isLoading && stallions.length === 0 && (
          <p className="col-span-3 text-sm text-stone-400 py-4">No stallions match filters.</p>
        )}
      </div>
    </div>
  )
}
