import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { getStallion } from '@/api/stallions'
import { useStallionSaleStats } from '@/api/auctionSales'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Horse } from '@/api/mares'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']

export default function StallionCompare() {
  const [searchParams] = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const [avgSortDir, setAvgSortDir] = useState<'asc' | 'desc' | null>(null)

  const queries = ids.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({ queryKey: ['stallion', id], queryFn: () => getStallion(id) }),
  )

  const saleStatsQueries = ids.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStallionSaleStats(id),
  )

  const loading = queries.some((q) => q.isLoading)
  const stallions = queries.map((q) => q.data).filter((s): s is Horse => !!s)

  const stallionAvg = (stallion: Horse): number | null =>
    saleStatsQueries.find((_, i) => ids[i] === stallion.id)?.data?.avg ?? null

  const sortedStallions = avgSortDir
    ? [...stallions].sort((a, b) => {
        const av = stallionAvg(a)
        const bv = stallionAvg(b)
        if (av === null && bv === null) return 0
        if (av === null) return 1
        if (bv === null) return -1
        return avgSortDir === 'asc' ? av - bv : bv - av
      })
    : stallions

  const allNoData = stallions.length > 0 && stallions.every((s) => (stallionAvg(s) === null))

  if (ids.length < 2) {
    return (
      <div className="space-y-4">
        <Link to="/stallions" className="text-sm text-stone-500 hover:text-stone-900">
          ← Back to Catalog
        </Link>
        <p className="text-stone-400 text-sm">Select at least 2 stallions to compare.</p>
      </div>
    )
  }

  if (loading) return <p className="text-sm text-stone-400">Loading…</p>

  const offspringData = [
    {
      metric: 'Offspring Count',
      ...stallions.reduce<Record<string, number>>((acc, s) => {
        acc[s.name] = s.offspringCount
        return acc
      }, {}),
    },
  ]

  const feeData = stallions
    .filter((s) => s.studFee != null)
    .map((s) => ({ name: s.name, fee: s.studFee! }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/stallions" className="text-sm text-stone-500 hover:text-stone-900">
          ← Back to Catalog
        </Link>
        <h1 className="text-xl font-bold">Stallion Comparison</h1>
      </div>

      {/* Offspring count chart */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Offspring Count</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={offspringData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
            <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {stallions.map((s, i) => (
              <Bar key={s.id} dataKey={s.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stud fee chart */}
      {feeData.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">Stud Fee (USD)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={feeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="fee" fill="#6366f1" name="Stud Fee" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparison table */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-4 py-3 text-stone-500 font-medium">Dimension</th>
              {sortedStallions.map((s) => (
                <th key={s.id} className="text-left px-4 py-3 font-semibold">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Breed', key: 'breed' as keyof Horse },
              { label: 'Discipline', key: 'discipline' as keyof Horse },
              { label: 'Offspring Count', key: 'offspringCount' as keyof Horse },
              { label: 'Stud Fee', key: 'studFee' as keyof Horse },
              { label: 'Location', key: 'studLocation' as keyof Horse },
            ].map(({ label, key }) => (
              <tr key={label} className="border-t border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-2 text-stone-500">{label}</td>
                {sortedStallions.map((s) => {
                  let val: React.ReactNode = (s[key] as string | number | undefined) ?? '—'
                  if (key === 'discipline') val = (s.discipline as string).replace(/_/g, ' ')
                  if (key === 'studFee' && s.studFee != null) val = `$${s.studFee.toLocaleString()}`
                  return (
                    <td key={s.id} className="px-4 py-2">
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t border-stone-100 hover:bg-stone-50">
              <td className="px-4 py-2 text-stone-500">
                <button
                  onClick={() => setAvgSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
                  className="flex items-center gap-1 hover:text-stone-900"
                >
                  Avg Auction Price
                  <span className="text-xs text-stone-400">{avgSortDir === 'desc' ? '↓' : avgSortDir === 'asc' ? '↑' : '↕'}</span>
                </button>
              </td>
              {allNoData ? (
                <td colSpan={sortedStallions.length} className="px-4 py-2 text-xs text-stone-400 italic">
                  No auction data — record sales to compare performance
                </td>
              ) : sortedStallions.map((s) => {
                const avg = stallionAvg(s)
                return (
                  <td key={s.id} className="px-4 py-2">
                    {avg != null ? avg.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'}
                  </td>
                )
              })}
            </tr>
            <tr className="border-t border-stone-100 hover:bg-stone-50">
              <td className="px-4 py-2 text-stone-500 align-top">Offspring Summary</td>
              {sortedStallions.map((s) => (
                <td key={s.id} className="px-4 py-2 text-xs text-stone-600 max-w-xs">
                  {s.offspringPerformanceSummary
                    ? s.offspringPerformanceSummary.slice(0, 120) + (s.offspringPerformanceSummary.length > 120 ? '…' : '')
                    : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
