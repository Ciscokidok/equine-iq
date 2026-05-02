import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getMare } from '@/api/mares'
import { getPairings } from '@/api/pairings'

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-700'
  return <span className={`text-4xl font-bold ${color}`}>{pct}%</span>
}

export default function MareProfile() {
  const { id } = useParams<{ id: string }>()
  const { data: mare, isLoading } = useQuery({ queryKey: ['mare', id], queryFn: () => getMare(id!) })
  const { data: allPairings = [] } = useQuery({ queryKey: ['pairings'], queryFn: getPairings })
  const pairings = allPairings.filter((p) => p.mareId === id)

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>
  if (!mare) return <p className="text-sm text-red-500">Mare not found.</p>

  const pedigree = mare.pedigree as Record<string, any>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mare.name}</h1>
          <p className="text-stone-500">{mare.breed} · {mare.discipline.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/mares/${id}/advisor`}
            className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900"
          >
            Run Mating Advisor
          </Link>
          <Link
            to={`/mares/${id}/edit`}
            className="border border-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-50"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 grid sm:grid-cols-2 gap-3 text-sm">
        {mare.color && <div><span className="text-stone-400">Color:</span> <span className="font-medium">{mare.color}</span></div>}
        {mare.heightHands && <div><span className="text-stone-400">Height:</span> <span className="font-medium">{mare.heightHands} hh</span></div>}
        {mare.dateOfBirth && <div><span className="text-stone-400">Born:</span> <span className="font-medium">{new Date(mare.dateOfBirth).getFullYear()}</span></div>}
        {mare.conformationNotes && (
          <div className="sm:col-span-2">
            <span className="text-stone-400">Conformation:</span>
            <p className="mt-0.5 text-stone-700">{mare.conformationNotes}</p>
          </div>
        )}
      </div>

      {/* Pedigree summary */}
      {Object.keys(pedigree).length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Pedigree</h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(pedigree).map(([key, val]) => (
              <div key={key}>
                <span className="text-stone-400 text-xs">{key.replace(/_/g, ' ')}:</span>{' '}
                <span>{(val as any)?.name ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past pairings */}
      {pairings.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Past Pairings</h2>
          <div className="space-y-2">
            {pairings.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-t border-stone-100 pt-2 first:border-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium">{p.stallion.name}</p>
                  <p className="text-xs text-stone-400">{p.goal}</p>
                </div>
                <ScoreBadge score={p.compatibilityScore} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
