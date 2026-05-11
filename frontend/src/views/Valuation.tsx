import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getStallionValuations, getSaleComparables, getPinhooking, getConsignors } from '@/api/analytics'

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

function PinhookingTab() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['valuation-pinhooking'], queryFn: getPinhooking })
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const horses = [...(data?.horses ?? [])].sort((a, b) =>
    sortDir === 'desc'
      ? (b.roiPct ?? -Infinity) - (a.roiPct ?? -Infinity)
      : (a.roiPct ?? -Infinity) - (b.roiPct ?? -Infinity)
  )

  if (isLoading) return <p className="text-sm text-stone-400 py-8">Loading…</p>
  if (isError) return <p className="text-sm text-red-500 py-8">Failed to load pinhooking data.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Horses sold at auction 2 or more times. Shows price delta between first and most recent sale.
        Positive ROI = appreciated in value; negative = depreciated.
      </p>
      {horses.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-4">No horses found with multiple sale records.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide">
                <th className="pb-2 pr-4">Horse</th>
                <th className="pb-2 pr-4">Sire</th>
                <th className="pb-2 pr-4">Sales</th>
                <th className="pb-2 pr-4">First Sale</th>
                <th className="pb-2 pr-4">Last Sale</th>
                <th className="pb-2 pr-4">Delta</th>
                <th className="pb-2 cursor-pointer select-none hover:text-stone-700" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                  ROI {sortDir === 'asc' ? '↑' : '↓'}
                </th>
              </tr>
            </thead>
            <tbody>
              {horses.map((h) => {
                const positive = (h.roiPct ?? 0) >= 0
                return (
                  <tr key={h.horseId} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="py-2.5 pr-4">
                      <Link to={`/stallions/${h.horseId}`} className="font-medium text-stone-900 hover:text-brand-700">{h.horseName}</Link>
                    </td>
                    <td className="py-2.5 pr-4 text-stone-500">{h.sire ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-stone-500">{h.saleCount}</td>
                    <td className="py-2.5 pr-4 text-stone-600">{fmt(h.firstPrice)}</td>
                    <td className="py-2.5 pr-4 font-medium text-stone-800">{fmt(h.lastPrice)}</td>
                    <td className={`py-2.5 pr-4 font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                      {positive ? '+' : ''}{fmt(h.priceDelta)}
                    </td>
                    <td className="py-2.5">
                      {h.roiPct !== null ? (
                        <span className={`text-sm font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                          {positive ? '+' : ''}{h.roiPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-stone-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConsignorsTab() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['valuation-consignors'], queryFn: getConsignors })
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const consignors = [...(data?.consignors ?? [])].sort((a, b) =>
    sortDir === 'desc'
      ? (b.avgVsSirePct ?? 0) - (a.avgVsSirePct ?? 0)
      : (a.avgVsSirePct ?? 0) - (b.avgVsSirePct ?? 0)
  )

  if (isLoading) return <p className="text-sm text-stone-400 py-8">Loading…</p>
  if (isError) return <p className="text-sm text-red-500 py-8">Failed to load consignor data.</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Consignors ranked by how their horses sell relative to the sire-group average.
        Above 100% means their horses consistently outperform bloodline benchmarks.
      </p>
      {consignors.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-4">No consignor data found.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide">
                <th className="pb-2 pr-4">Consignor</th>
                <th className="pb-2 pr-4">Sales</th>
                <th className="pb-2 pr-4">Avg Price</th>
                <th className="pb-2 pr-4">Median</th>
                <th className="pb-2 pr-4">Total Volume</th>
                <th className="pb-2 pr-4">Beat Sire Avg</th>
                <th className="pb-2 cursor-pointer select-none hover:text-stone-700" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                  vs Sire Benchmark {sortDir === 'asc' ? '↑' : '↓'}
                </th>
              </tr>
            </thead>
            <tbody>
              {consignors.map((c) => {
                const pct = c.avgVsSirePct
                const color = pct === null ? 'text-stone-400' : pct >= 110 ? 'text-emerald-600' : pct >= 90 ? 'text-stone-600' : 'text-red-500'
                return (
                  <tr key={c.consignor} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="py-2.5 pr-4 font-medium text-stone-900">{c.consignor}</td>
                    <td className="py-2.5 pr-4 text-stone-500">{c.saleCount}</td>
                    <td className="py-2.5 pr-4 text-stone-600">{fmt(c.avgPrice)}</td>
                    <td className="py-2.5 pr-4 text-stone-500">{fmt(c.medianPrice)}</td>
                    <td className="py-2.5 pr-4 text-stone-500">{fmt(c.totalVolume)}</td>
                    <td className="py-2.5 pr-4 text-stone-500">{c.beatsSireAvg} / {c.saleCount}</td>
                    <td className={`py-2.5 font-semibold ${color}`}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type TabKey = 'stallions' | 'comparables' | 'pinhooking' | 'consignors'

export default function Valuation() {
  const [tab, setTab] = useState<TabKey>('stallions')

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'stallions', label: 'Stallion ROI' },
    { key: 'comparables', label: 'Sale Comparables' },
    { key: 'pinhooking', label: 'Pinhooking ROI' },
    { key: 'consignors', label: 'Consignors' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Valuation</h1>
        <p className="text-sm text-stone-500 mt-1">
          Market analysis based on Keeneland auction results.
        </p>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-stone-800 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'stallions' && <StallionTab />}
        {tab === 'comparables' && <ComparablesTab />}
        {tab === 'pinhooking' && <PinhookingTab />}
        {tab === 'consignors' && <ConsignorsTab />}
      </div>
    </div>
  )
}
