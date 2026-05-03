import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMares } from '@/api/mares'
import { getPairings } from '@/api/pairings'
import type { SavedPairing } from '@/api/pairings'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'bg-green-100 text-green-800' : pct >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{pct}%</span>
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-xs text-stone-400 mt-0.5">{label}</p>
    </div>
  )
}

function buildTrendData(pairings: SavedPairing[]) {
  return [...pairings]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((p) => ({
      date: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Math.round(p.compatibilityScore * 100),
    }))
}

function buildStallionData(pairings: SavedPairing[]) {
  const map: Record<string, number[]> = {}
  for (const p of pairings) {
    const name = p.stallion.name
    if (!map[name]) map[name] = []
    map[name].push(p.compatibilityScore * 100)
  }
  return Object.entries(map)
    .map(([name, scores]) => ({
      name,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)
}

export default function Dashboard() {
  const { data: mares = [], isLoading: maresLoading } = useQuery({ queryKey: ['mares'], queryFn: getMares })
  const { data: pairings = [] } = useQuery({ queryKey: ['pairings'], queryFn: getPairings })
  const [disciplineFilter, setDisciplineFilter] = useState('')

  const recentPairings = pairings.slice(0, 5)
  const avgScore = pairings.length
    ? Math.round(pairings.reduce((s, p) => s + p.compatibilityScore * 100, 0) / pairings.length)
    : null
  const activeMares = new Set(pairings.map((p) => p.mareId)).size

  const trendData = buildTrendData(pairings)
  const stallionData = buildStallionData(pairings)

  const disciplines = Array.from(new Set(mares.map(m => m.discipline))).sort()
  const filteredMares = disciplineFilter ? mares.filter(m => m.discipline === disciplineFilter) : mares

  return (
    <div className="space-y-8">
      {/* Mares */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your Mares</h2>
          <Link
            to="/mares/new"
            className="text-sm bg-brand-700 text-white px-3 py-1.5 rounded hover:bg-brand-900 transition-colors"
          >
            + Add Mare
          </Link>
        </div>

        {disciplines.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setDisciplineFilter('')}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                !disciplineFilter ? 'bg-brand-700 text-white border-brand-700' : 'border-stone-200 text-stone-500 hover:border-stone-400'
              }`}
            >
              All
            </button>
            {disciplines.map(d => (
              <button
                key={d}
                onClick={() => setDisciplineFilter(d)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  disciplineFilter === d ? 'bg-brand-700 text-white border-brand-700' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                }`}
              >
                {d.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}

        {maresLoading && <p className="text-sm text-stone-400">Loading...</p>}
        {!maresLoading && mares.length === 0 && (
          <div className="border-2 border-dashed border-stone-200 rounded-lg p-8 text-center">
            <p className="text-stone-500 mb-3">No mares yet.</p>
            <Link to="/mares/new" className="text-brand-700 font-medium text-sm hover:underline">
              Add your first mare →
            </Link>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMares.map((mare) => (
            <div key={mare.id} className="bg-white border border-stone-200 rounded-lg p-4 flex flex-col gap-2">
              <div>
                <p className="font-semibold text-stone-900">{mare.name}</p>
                <p className="text-xs text-stone-400">{mare.breed} · {mare.discipline.replace(/_/g, ' ')}</p>
              </div>
              <div className="flex gap-2 mt-auto pt-2">
                <Link
                  to={`/mares/${mare.id}/advisor`}
                  className="flex-1 text-center text-xs bg-brand-700 text-white py-1.5 rounded hover:bg-brand-900 transition-colors"
                >
                  Find a Stallion
                </Link>
                <Link
                  to={`/mares/${mare.id}`}
                  className="flex-1 text-center text-xs border border-stone-200 py-1.5 rounded hover:bg-stone-50 transition-colors"
                >
                  View Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics */}
      {(mares.length > 0 || pairings.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Analytics</h2>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total Mares" value={mares.length} />
            <StatCard label="Total Pairings" value={pairings.length} />
            <StatCard label="Avg Compatibility" value={avgScore != null ? `${avgScore}%` : '—'} />
            <StatCard label="Mares with Pairings" value={activeMares} />
          </div>

          {/* Score trend */}
          {trendData.length >= 2 && (
            <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Pairing Scores Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#16a34a' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top stallions */}
          {stallionData.length >= 1 && (
            <div className="bg-white border border-stone-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Top Stallions by Avg Score</h3>
              <ResponsiveContainer width="100%" height={Math.max(120, stallionData.length * 44)}>
                <BarChart
                  data={stallionData}
                  layout="vertical"
                  margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${Math.round(v)}%`} />
                  <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                    {stallionData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#16a34a' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      {/* Recent Pairings */}
      {recentPairings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Pairings</h2>
            <Link to="/pairings" className="text-sm text-brand-700 hover:underline">View all →</Link>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg divide-y divide-stone-100">
            {recentPairings.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{p.mare.name} × {p.stallion.name}</p>
                  <p className="text-xs text-stone-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <ScoreBadge score={p.compatibilityScore} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
