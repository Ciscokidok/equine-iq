import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getHorsePedigree } from '@/api/horses'
import PedigreeTree from '@/components/PedigreeTree'

export default function PedigreeView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pedigree', id],
    queryFn: () => getHorsePedigree(id!),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>
  if (isError || !data) return <p className="text-sm text-red-500">Failed to load pedigree.</p>

  const { horse, pedigree, inbreeding_flags } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold">{horse.name}</h1>
          <p className="text-stone-500 text-sm">{horse.breed} · Pedigree Tree</p>
        </div>
      </div>

      {inbreeding_flags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Inbreeding Detected</p>
          <div className="flex flex-wrap gap-2">
            {inbreeding_flags.map((flag) => (
              <span
                key={flag.name}
                className={`text-xs px-2 py-1 rounded font-medium ${
                  flag.severity === 'high'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {flag.name} (×{flag.count})
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="bg-white border border-stone-200 rounded-lg overflow-hidden"
        style={{ height: 500 }}
      >
        {Object.keys(pedigree).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-stone-400 text-sm">No pedigree data available for this horse.</p>
          </div>
        ) : (
          <PedigreeTree horse={horse} pedigree={pedigree} inbreedingFlags={inbreeding_flags} />
        )}
      </div>

      <p className="text-xs text-stone-400">
        Amber borders indicate horses appearing 2+ times. Red borders indicate 3+ occurrences (high inbreeding risk).
      </p>
    </div>
  )
}
