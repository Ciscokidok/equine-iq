import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getMares } from '@/api/mares'
import { getPairings } from '@/api/pairings'

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'bg-green-100 text-green-800' : pct >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{pct}%</span>
}

export default function Dashboard() {
  const { data: mares = [], isLoading: maresLoading } = useQuery({ queryKey: ['mares'], queryFn: getMares })
  const { data: pairings = [] } = useQuery({ queryKey: ['pairings'], queryFn: getPairings })

  const recentPairings = pairings.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Mares */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Mares</h2>
          <Link
            to="/mares/new"
            className="text-sm bg-brand-700 text-white px-3 py-1.5 rounded hover:bg-brand-900 transition-colors"
          >
            + Add Mare
          </Link>
        </div>

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
          {mares.map((mare) => (
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
