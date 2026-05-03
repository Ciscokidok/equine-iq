import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getMare, updateMare } from '@/api/mares'
import { getPairings } from '@/api/pairings'
import GeneticRiskPanel from '@/components/GeneticRiskPanel'
import { toast } from 'sonner'

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-700'
  return <span className={`text-4xl font-bold ${color}`}>{pct}%</span>
}

type PerformanceRecord = { event: string; date: string; placement?: string; score?: number }

function PerformanceSection({ mareId, records }: { mareId: string; records: PerformanceRecord[] }) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ event: '', date: '', placement: '', score: '' })

  const mutation = useMutation({
    mutationFn: (newRecord: PerformanceRecord) =>
      updateMare(mareId, {
        performanceRecords: [...records, newRecord],
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mare', mareId] })
      toast.success('Result added')
      setAdding(false)
      setForm({ event: '', date: '', placement: '', score: '' })
    },
    onError: () => toast.error('Failed to add result'),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.event || !form.date) return
    mutation.mutate({
      event: form.event,
      date: form.date,
      placement: form.placement || undefined,
      score: form.score ? parseFloat(form.score) : undefined,
    })
  }

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Performance Records</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs text-brand-700 hover:underline"
        >
          {adding ? 'Cancel' : '+ Add Result'}
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} className="mb-4 grid sm:grid-cols-2 gap-3 border-b border-stone-100 pb-4">
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Event *</label>
            <input
              value={form.event}
              onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))}
              className="input w-full text-sm"
              placeholder="e.g. Devon Horse Show"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="input w-full text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Placement</label>
            <input
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
              className="input w-full text-sm"
              placeholder="e.g. 1st, Reserve Champion"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Score</label>
            <input
              type="number"
              step="0.01"
              value={form.score}
              onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
              className="input w-full text-sm"
              placeholder="e.g. 72.5"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save Result'}
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 && !adding && (
        <p className="text-xs text-stone-400">No performance records yet.</p>
      )}

      {sorted.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 border-b border-stone-100">
              <th className="text-left pb-1">Date</th>
              <th className="text-left pb-1">Event</th>
              <th className="text-left pb-1">Placement</th>
              <th className="text-right pb-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-t border-stone-50">
                <td className="py-1.5 text-stone-400 text-xs pr-3">{new Date(r.date).toLocaleDateString()}</td>
                <td className="py-1.5 font-medium">{r.event}</td>
                <td className="py-1.5 text-stone-500">{r.placement ?? '—'}</td>
                <td className="py-1.5 text-right text-stone-500">{r.score != null ? r.score : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function MareProfile() {
  const { id } = useParams<{ id: string }>()
  const { data: mare, isLoading } = useQuery({ queryKey: ['mare', id], queryFn: () => getMare(id!) })
  const { data: allPairings = [] } = useQuery({ queryKey: ['pairings'], queryFn: getPairings })
  const pairings = allPairings.filter((p) => p.mareId === id)

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>
  if (!mare) return <p className="text-sm text-red-500">Mare not found.</p>

  const pedigree = mare.pedigree as Record<string, any>
  const performanceRecords: PerformanceRecord[] = (mare.performanceRecords as PerformanceRecord[]) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mare.name}</h1>
          <p className="text-stone-500">{mare.breed} · {mare.discipline.replace(/_/g, ' ')}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Link
            to={`/horses/${id}/pedigree`}
            className="border border-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-50"
          >
            Pedigree Tree
          </Link>
          <Link
            to={`/mares/${id}/heat-cycles`}
            className="border border-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-50"
          >
            Heat Cycle
          </Link>
          <Link
            to="/foals"
            className="border border-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-50"
          >
            Foal Outcomes
          </Link>
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Pedigree</h2>
            <Link to={`/horses/${id}/pedigree`} className="text-xs text-brand-700 hover:underline">
              View tree →
            </Link>
          </div>
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

      {/* Performance records */}
      <PerformanceSection mareId={id!} records={performanceRecords} />

      {/* Genetic risks */}
      <GeneticRiskPanel mareBreed={mare.breed} stallionBreed="" discipline={mare.discipline} />

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
