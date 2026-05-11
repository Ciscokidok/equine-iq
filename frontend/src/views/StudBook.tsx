import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getStudBook, recordBreeding, updateBreeding, recordFoal, deleteBreeding } from '@/api/breedings'
import type { StudBookMare, BreedingStatus } from '@/api/breedings'
import { getMares } from '@/api/mares'
import { getStallions } from '@/api/stallions'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  bred: 'Bred',
  confirmed_in_foal: 'In Foal',
  foaled: 'Foaled',
  slipped: 'Slipped',
  barren: 'Barren',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-stone-100 text-stone-500',
  bred: 'bg-amber-100 text-amber-700',
  confirmed_in_foal: 'bg-emerald-100 text-emerald-700',
  foaled: 'bg-blue-100 text-blue-700',
  slipped: 'bg-red-100 text-red-600',
  barren: 'bg-red-50 text-red-400',
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const d = new Date(date).getTime() - Date.now()
  return Math.ceil(d / (1000 * 60 * 60 * 24))
}

function MareCard({ mare, onRefresh }: { mare: StudBookMare; onRefresh: () => void }) {
  const qc = useQueryClient()
  const b = mare.latestBreeding
  const status = b?.status ?? 'open'
  const [showFoalForm, setShowFoalForm] = useState(false)
  const [foalForm, setFoalForm] = useState({ foaledAt: '', name: '', sex: '', color: '', notes: '' })

  const updateStatus = useMutation({
    mutationFn: ({ status, extra }: { status: BreedingStatus; extra?: object }) =>
      updateBreeding(b!.id, { status, ...extra }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stud-book'] }); onRefresh() },
    onError: () => toast.error('Update failed'),
  })

  const addFoal = useMutation({
    mutationFn: () => recordFoal(b!.id, {
      foaledAt: foalForm.foaledAt,
      name: foalForm.name || undefined,
      sex: foalForm.sex || undefined,
      color: foalForm.color || undefined,
      notes: foalForm.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stud-book'] })
      setShowFoalForm(false)
      onRefresh()
      toast.success('Foal recorded')
    },
    onError: () => toast.error('Failed to record foal'),
  })

  const days = b?.expectedFoalDate ? daysUntil(b.expectedFoalDate) : null

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`/mares/${mare.id}`} className="font-semibold text-stone-900 hover:text-brand-700">
            {mare.name}
          </Link>
          {mare.dateOfBirth && (
            <p className="text-xs text-stone-400 mt-0.5">
              b. {new Date(mare.dateOfBirth).getFullYear()} · {mare.color ?? mare.breed}
            </p>
          )}
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {b && (
        <div className="text-sm space-y-1 border-t border-stone-100 pt-3">
          <div className="flex justify-between">
            <span className="text-stone-500">Bred to</span>
            <Link to={`/stallions/${b.stallion.id}`} className="font-medium text-stone-800 hover:text-brand-700">
              {b.stallion.name}
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Bred on</span>
            <span className="text-stone-700">{new Date(b.bredDate).toLocaleDateString()}</span>
          </div>
          {b.studFeeCents && (
            <div className="flex justify-between">
              <span className="text-stone-500">Stud fee</span>
              <span className="text-stone-700">
                {(b.studFeeCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
          {b.expectedFoalDate && (
            <div className="flex justify-between">
              <span className="text-stone-500">Due</span>
              <span className={`font-medium ${days !== null && days <= 30 ? 'text-amber-600' : 'text-stone-700'}`}>
                {new Date(b.expectedFoalDate).toLocaleDateString()}
                {days !== null && days > 0 && ` (${days}d)`}
                {days !== null && days <= 0 && ' (overdue)'}
              </span>
            </div>
          )}
          {b.foal && (
            <div className="flex justify-between">
              <span className="text-stone-500">Foal</span>
              <Link to={`/foals`} className="font-medium text-blue-600 hover:underline">
                {b.foal.name ?? `${b.foal.sex ?? 'Foal'} · ${b.foal.foaledAt ? new Date(b.foal.foaledAt).toLocaleDateString() : ''}`}
              </Link>
            </div>
          )}
          {b.notes && <p className="text-xs text-stone-400 pt-1">{b.notes}</p>}
        </div>
      )}

      {/* Quick action buttons */}
      {b && !b.foal && (
        <div className="flex gap-2 flex-wrap pt-1">
          {status === 'bred' && (
            <button
              onClick={() => updateStatus.mutate({ status: 'confirmed_in_foal', extra: { confirmedAt: new Date().toISOString() } })}
              disabled={updateStatus.isPending}
              className="text-xs px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
            >
              ✓ Confirm In Foal
            </button>
          )}
          {(status === 'bred' || status === 'confirmed_in_foal') && (
            <button
              onClick={() => setShowFoalForm(v => !v)}
              className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Record Foal Born
            </button>
          )}
          {(status === 'bred' || status === 'confirmed_in_foal') && (
            <button
              onClick={() => updateStatus.mutate({ status: 'slipped' })}
              disabled={updateStatus.isPending}
              className="text-xs px-3 py-1.5 rounded border border-stone-200 text-stone-400 hover:bg-stone-50 disabled:opacity-40"
            >
              Slipped
            </button>
          )}
        </div>
      )}

      {showFoalForm && (
        <div className="border-t border-stone-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-stone-600">Record Foal</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-stone-400 mb-1">Foaling date *</label>
              <input type="date" value={foalForm.foaledAt} onChange={e => setFoalForm(f => ({ ...f, foaledAt: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Name</label>
              <input type="text" value={foalForm.name} onChange={e => setFoalForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Sex</label>
              <select value={foalForm.sex} onChange={e => setFoalForm(f => ({ ...f, sex: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
                <option value="">—</option>
                <option value="stallion">Colt</option>
                <option value="mare">Filly</option>
                <option value="gelding">Gelding</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Color</label>
              <input type="text" value={foalForm.color} onChange={e => setFoalForm(f => ({ ...f, color: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="e.g. Bay" />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">Notes</label>
              <input type="text" value={foalForm.notes} onChange={e => setFoalForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => addFoal.mutate()} disabled={!foalForm.foaledAt || addFoal.isPending}
              className="px-3 py-1.5 bg-stone-800 text-white text-xs rounded hover:bg-stone-900 disabled:opacity-40">
              {addFoal.isPending ? 'Saving…' : 'Save Foal'}
            </button>
            <button onClick={() => setShowFoalForm(false)} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function RecordBreedingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient()
  const { data: maresData } = useQuery({ queryKey: ['mares'], queryFn: getMares })
  const { data: stallionsData } = useQuery({ queryKey: ['stallions-all'], queryFn: () => getStallions() })

  const [form, setForm] = useState({
    mareId: '', stallionId: '', bredDate: new Date().toISOString().split('T')[0],
    studFeeCents: '', expectedFoalDate: '', notes: '',
  })

  const create = useMutation({
    mutationFn: () => recordBreeding({
      mareId: form.mareId,
      stallionId: form.stallionId,
      bredDate: form.bredDate,
      studFeeCents: form.studFeeCents ? Math.round(parseFloat(form.studFeeCents) * 100) : undefined,
      expectedFoalDate: form.expectedFoalDate || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stud-book'] })
      onSaved()
      toast.success('Breeding recorded')
    },
    onError: () => toast.error('Failed to record breeding'),
  })

  const mares = maresData ?? []
  const stallions = stallionsData ?? []

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Record Breeding</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Mare *</label>
            <select value={form.mareId} onChange={e => setForm(f => ({ ...f, mareId: e.target.value }))}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm">
              <option value="">Select mare…</option>
              {mares.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Stallion *</label>
            <select value={form.stallionId} onChange={e => setForm(f => ({ ...f, stallionId: e.target.value }))}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm">
              <option value="">Select stallion…</option>
              {stallions.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Date bred *</label>
              <input type="date" value={form.bredDate} onChange={e => setForm(f => ({ ...f, bredDate: e.target.value }))}
                className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Expected foal date</label>
              <input type="date" value={form.expectedFoalDate} onChange={e => setForm(f => ({ ...f, expectedFoalDate: e.target.value }))}
                className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Stud fee paid ($)</label>
            <input type="number" value={form.studFeeCents} onChange={e => setForm(f => ({ ...f, studFeeCents: e.target.value }))}
              placeholder="e.g. 15000" className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="Optional" />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => create.mutate()}
            disabled={!form.mareId || !form.stallionId || !form.bredDate || create.isPending}
            className="flex-1 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-900 disabled:opacity-40"
          >
            {create.isPending ? 'Saving…' : 'Record Breeding'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700">Cancel</button>
        </div>
      </div>
    </div>
  )
}

type StatusFilter = 'all' | 'open' | 'bred' | 'confirmed_in_foal' | 'foaled'

export default function StudBook() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stud-book'],
    queryFn: getStudBook,
  })

  const mares = data?.mares ?? []
  const counts = data?.counts ?? { open: 0, bred: 0, confirmed_in_foal: 0, foaled: 0, other: 0 }

  const filtered = filter === 'all' ? mares : mares.filter((m) => {
    const s = m.latestBreeding?.status ?? 'open'
    return s === filter
  })

  const dueNext30 = mares.filter((m) => {
    const d = m.latestBreeding?.expectedFoalDate
    if (!d) return false
    const days = daysUntil(d)
    return days !== null && days >= 0 && days <= 30
  })

  if (isLoading) return <p className="text-sm text-stone-400 py-8">Loading…</p>
  if (isError) return <p className="text-sm text-red-500 py-8">Failed to load stud book.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Stud Book</h1>
          <p className="text-sm text-stone-500 mt-1">Breeding records and mare status for the current season.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-stone-800 text-white text-sm font-medium rounded-lg hover:bg-stone-900"
        >
          + Record Breeding
        </button>
      </div>

      {/* Status summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { key: 'open', label: 'Open', count: counts.open, color: 'text-stone-600' },
          { key: 'bred', label: 'Bred', count: counts.bred, color: 'text-amber-600' },
          { key: 'confirmed_in_foal', label: 'In Foal', count: counts.confirmed_in_foal, color: 'text-emerald-600' },
          { key: 'foaled', label: 'Foaled', count: counts.foaled, color: 'text-blue-600' },
        ] as const).map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
            className={`bg-white border rounded-xl p-4 text-left transition-all ${filter === s.key ? 'border-stone-400 ring-1 ring-stone-300' : 'border-stone-200 hover:border-stone-300'}`}
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Due soon alert */}
      {dueNext30.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-medium text-amber-800">
            {dueNext30.length} {dueNext30.length === 1 ? 'mare' : 'mares'} due to foal in the next 30 days
          </p>
          <p className="text-sm text-amber-700 mt-1">
            {dueNext30.map(m => `${m.name} (${new Date(m.latestBreeding!.expectedFoalDate!).toLocaleDateString()})`).join(' · ')}
          </p>
        </div>
      )}

      {/* Mare grid */}
      {mares.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-stone-500">No mares in your program yet.</p>
          <div className="flex justify-center gap-3">
            <Link to="/mares/new" className="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              Add a Mare
            </Link>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-900">
              Record Breeding
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-stone-400 italic py-4">No mares with status "{STATUS_LABELS[filter]}".</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mare) => (
            <MareCard key={mare.id} mare={mare} onRefresh={refetch} />
          ))}
        </div>
      )}

      {showModal && (
        <RecordBreedingModal
          onClose={() => setShowModal(false)}
          onSaved={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
