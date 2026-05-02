import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPairings, deletePairing } from '@/api/pairings'
import { toast } from 'sonner'

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'bg-green-100 text-green-800' : pct >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-sm font-bold px-2 py-0.5 rounded ${color}`}>{pct}%</span>
}

export default function Pairings() {
  const qc = useQueryClient()
  const { data: pairings = [], isLoading } = useQuery({ queryKey: ['pairings'], queryFn: getPairings })

  const deleteMutation = useMutation({
    mutationFn: deletePairing,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pairings'] }); toast.success('Deleted') },
    onError: () => toast.error('Delete failed'),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Saved Pairings</h1>

      {pairings.length === 0 && (
        <p className="text-stone-400 text-sm">No saved pairings yet. Run the mating advisor on a mare to get started.</p>
      )}

      <div className="space-y-3">
        {pairings.map((p) => (
          <div key={p.id} className="bg-white border border-stone-200 rounded-lg p-4 flex items-start gap-4">
            <ScoreBadge score={p.compatibilityScore} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{p.mare.name} × {p.stallion.name}</p>
              <p className="text-xs text-stone-400 truncate">{p.goal}</p>
              <p className="text-xs text-stone-300 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => deleteMutation.mutate(p.id)}
              disabled={deleteMutation.isPending}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
