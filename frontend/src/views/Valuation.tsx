import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getStallionValuations, getSaleComparables } from '@/api/analytics'

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function RatioBadge({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-stone-400 text-xs">No stud fee</span>
  const pct = Math.round(ratio * 100)
  const color =
    ratio >= 1.5 ? 'bg-red-100 text-red-700' :
    ratio >= 1.0 ? 'bg-amber-100 text-amber-700' :
    ratio >= 0.5 ? 'bg-emerald-100 text-emerald-700' :
    'bg-blue-100 text-blue-700'
  const label =
    ratio >= 1.5 ? 'Overvalued' :
    ratio >= 1.0 ? 'Above avg' :
    ratio >= 0.5 ? 'Good value' :
    'Undervalued'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label} <span className="opacity-60">{pct}%</span>
    </span>
  )
}

function ComparableRatioBadge({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100)
  const color =
    ratio >= 1.5 ? 'bg-red-100 text-red-700' :
    ratio >= 1.1 ? 'bg-amber-100 text-amber-700' :
    ratio >= 0.9 ? 'bg-stone-100 text-stone-600' :
    ratio >= 0.6 ? 'bg-emerald-100 text-emerald-700' :
    'bg-blue-100 text-blue-700'
  const label =
    ratio >= 1.5 ? 'Well above' :
    ratio >= 1.1 ? 'Above avg' :
    ratio >= 0.9 ? 'At avg' :
    ratio >= 0.6 ? 'Below avg' :
    'Far below'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {label} <span className="opacity-60">{pct}%</span>
    </span>
  )
}

type SortKey = 'ratio' | 'studFee' | 'avgPrice' | 'progenyCount' | 'name'
type SortDir = 'asc' | 'desc'

function StallionTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['valuation-stallions'],
    queryFn: getStallionValuations,
  })
  const [sortKey, setSortKey] = useState<SortKey>('ratio')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter] = useState<'all' | 'overvalued' | 'undervalued' | 'no-fee'>('all')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const stallions = data?.stallions ?? []

  const filtered = stallions.filter((s) => {
    if (filter === 'overvalued') return s.studFeeToAvgRatio !== null && s.studFeeToAvgRatio >= 1.0
    if (filter === 'undervalued') return s.studFeeToAvgRatio !== null && s.studFeeToAvgRatio < 1.0
    if (filter === 'no-fee') return s.studFee === null
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number
    if (sortKey === 'ratio') { av = a.studFeeToAvgRatio ?? -1; bv = b.studFeeToAvgRatio ?? -1 }
    else if (sortKey === 'studFee') { av = a.studFee ?? -1; bv = b.studFee ?? -1 }
    else if (sortKey === 'avgPrice') { av = a.avgProgenyPrice; bv = b.avgProgenyPrice }
    else if (sortKey === 'progenyCount') { av = a.progenyCount; bv = b.progenyCount }
    else { return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name) }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th
        className="pb-2 pr-4 text-left cursor-pointer select-none hover:text-stone-700"
        onClick={() => toggleSort(k)}
      >
        {label}
        {active && <span className="ml-1 text-stone-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </th>
    )
  }

  if (isLoading) return <p className="text-sm text-stone-400 py-8">Loading…</p>
  if (isError) return <p className="text-sm text-red-500 py-8">Failed to load valuation data.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm text-stone-500">
          Compares stud fee to the average sale price of offspring at auction.
          Ratio &gt; 100% means the stallion charges more than his progeny return — potentially overvalued.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['all', 'overvalued', 'undervalued', 'no-fee'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'
            }`}
          >
            {f === 'all' ? `All (${stallions.length})` :
             f === 'overvalued' ? 'Overvalued' :
             f === 'undervalued' ? 'Good value / Undervalued' :
             'No stud fee set'}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-4">
          {stallions.length === 0
            ? 'No stallions with progeny sale data found. Sync more Keeneland sales first.'
            : 'No stallions match this filter.'}
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide">
                <SortHeader label="Stallion" k="name" />
                <SortHeader label="Stud Fee" k="studFee" />
                <SortHeader label="Avg Progeny Price" k="avgPrice" />
                <th className="pb-2 pr-4 text-left text-xs text-stone-400 uppercase tracking-wide">Median</th>
                <th className="pb-2 pr-4 text-left text-xs text-stone-400 uppercase tracking-wide">Range</th>
                <SortHeader label="Sales" k="progenyCount" />
                <SortHeader label="Valuation" k="ratio" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="py-2.5 pr-4">
                    <Link to={`/stallions/${s.id}`} className="font-medium text-stone-900 hover:text-brand-700">
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-stone-600">
                    {s.studFee ? fmt(s.studFee * 100) : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-stone-800">{fmt(s.avgProgenyPrice)}</td>
                  <td className="py-2.5 pr-4 text-stone-500">{fmt(s.medianProgenyPrice)}</td>
                  <td className="py-2.5 pr-4 text-stone-400 text-xs">
                    {fmt(s.minProgenyPrice)} – {fmt(s.maxProgenyPrice)}
                  </td>
                  <td className="py-2.5 pr-4 text-stone-500">{s.progenyCount}</td>
                  <td className="py-2.5">
                    <RatioBadge ratio={s.studFeeToAvgRatio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type CompSortKey = 'ratio' | 'salePrice' | 'sireAvg' | 'horseName' | 'sire' | 'saleDate'

function ComparablesTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['valuation-comparables'],
    queryFn: getSaleComparables,
  })
  const [sortKey, setCompSortKey] = useState<CompSortKey>('ratio')
  const [sortDir, setCompSortDir] = useState<SortDir>('desc')
  const [sireFilter, setSireFilter] = useState('')

  function toggleSort(key: CompSortKey) {
    if (sortKey === key) {
      setCompSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setCompSortKey(key)
      setCompSortDir('desc')
    }
  }

  const comparables = data?.comparables ?? []
  const sires = [...new Set(comparables.map((c) => c.sire).filter(Boolean))].sort() as string[]

  const filtered = sireFilter ? comparables.filter((c) => c.sire === sireFilter) : comparables

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number
    if (sortKey === 'ratio') { av = a.ratio; bv = b.ratio }
    else if (sortKey === 'salePrice') { av = a.salePrice; bv = b.salePrice }
    else if (sortKey === 'sireAvg') { av = a.sireAvg; bv = b.sireAvg }
    else if (sortKey === 'saleDate') { av = new Date(a.saleDate).getTime(); bv = new Date(b.saleDate).getTime() }
    else if (sortKey === 'horseName') {
      return sortDir === 'asc' ? a.horseName.localeCompare(b.horseName) : b.horseName.localeCompare(a.horseName)
    } else {
      const as = a.sire ?? ''; const bs = b.sire ?? ''
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function SortHeader({ label, k }: { label: string; k: CompSortKey }) {
    const active = sortKey === k
    return (
      <th
        className="pb-2 pr-4 text-left cursor-pointer select-none hover:text-stone-700"
        onClick={() => toggleSort(k)}
      >
        {label}
        {active && <span className="ml-1 text-stone-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </th>
    )
  }

  if (isLoading) return <p className="text-sm text-stone-400 py-8">Loading…</p>
  if (isError) return <p className="text-sm text-red-500 py-8">Failed to load comparable data.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Each horse's sale price compared to the average for all horses with the same sire.
        Only sires with 3+ offspring in the sale data are included.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sireFilter}
          onChange={(e) => setSireFilter(e.target.value)}
          className="border border-stone-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All sires ({comparables.length} sales)</option>
          {sires.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {sireFilter && (
          <button onClick={() => setSireFilter('')} className="text-xs text-stone-400 hover:text-stone-600">
            Clear filter
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-4">
          {comparables.length === 0
            ? 'No comparable data found. Sync Keeneland sales first.'
            : 'No results for this sire.'}
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide">
                <SortHeader label="Horse" k="horseName" />
                <SortHeader label="Sire" k="sire" />
                <SortHeader label="Sale Price" k="salePrice" />
                <SortHeader label="Sire Avg" k="sireAvg" />
                <th className="pb-2 pr-4 text-left text-xs text-stone-400 uppercase tracking-wide">Sire Sales</th>
                <SortHeader label="Date" k="saleDate" />
                <th className="pb-2 pr-4 text-left text-xs text-stone-400 uppercase tracking-wide">Session</th>
                <SortHeader label="vs Sire Avg" k="ratio" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.saleId} className="border-t border-stone-100 hover:bg-stone-50">
                  <td className="py-2.5 pr-4">
                    <Link to={`/stallions/${c.horseId}`} className="font-medium text-stone-900 hover:text-brand-700">
                      {c.horseName}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-stone-500">{c.sire ?? '—'}</td>
                  <td className="py-2.5 pr-4 font-medium text-stone-800">{fmt(c.salePrice)}</td>
                  <td className="py-2.5 pr-4 text-stone-500">{fmt(c.sireAvg)}</td>
                  <td className="py-2.5 pr-4 text-stone-400">{c.sireCount}</td>
                  <td className="py-2.5 pr-4 text-stone-400 text-xs">
                    {new Date(c.saleDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 pr-4 text-stone-400 text-xs">{c.saleSession ?? '—'}</td>
                  <td className="py-2.5">
                    <ComparableRatioBadge ratio={c.ratio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Valuation() {
  const [tab, setTab] = useState<'stallions' | 'comparables'>('stallions')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Valuation</h1>
        <p className="text-sm text-stone-500 mt-1">
          Market analysis based on Keeneland auction results.
        </p>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {(['stallions', 'comparables'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-stone-800 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t === 'stallions' ? 'Stallion ROI' : 'Sale Comparables'}
          </button>
        ))}
      </div>

      <div>
        {tab === 'stallions' ? <StallionTab /> : <ComparablesTab />}
      </div>
    </div>
  )
}
