import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'

function getTokenRole(): string | null {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}

const DISCIPLINES = [
  'sport_horse', 'warmblood', 'quarter_horse', 'paint', 'reining', 'cutting',
  'barrel_racing', 'flat_racing', 'thoroughbred_racing', 'hunter_jumper',
  'dressage', 'eventing', 'other',
] as const

type Discipline = typeof DISCIPLINES[number]

interface Stallion {
  id: string
  name: string
  breed: string
  discipline: Discipline
  studFee: number | null
  studLocation: string | null
  studBookingUrl: string | null
  offspringCount: number
  offspringPerformanceSummary: string | null
  registrationNumber: string | null
  epdNotes: string | null
  externalProfileUrl: string | null
  pedigree: Record<string, unknown>
  lastReviewedAt: string | null
  updatedAt: string
  createdAt: string
}

const listStallions = (): Promise<Stallion[]> => client.get('/api/admin/stallions').then(r => r.data)
const updateStallion = (id: string, data: Partial<Stallion>) => client.put(`/api/admin/stallions/${id}`, data).then(r => r.data)
const markReviewed = (id: string) => client.post(`/api/admin/stallions/${id}/review`).then(r => r.data)
const createStallion = (data: Partial<Stallion>) => client.post('/api/admin/stallions', data).then(r => r.data)

function stalenessDate(s: Stallion): Date {
  return new Date(s.lastReviewedAt ?? s.updatedAt)
}

function stalenessMonths(s: Stallion): number {
  const ms = Date.now() - stalenessDate(s).getTime()
  return ms / (1000 * 60 * 60 * 24 * 30)
}

function stalenessDot(months: number): string {
  if (months < 6) return 'bg-emerald-400'
  if (months < 12) return 'bg-amber-400'
  return 'bg-red-400'
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function fmtFee(fee: number | null): string {
  if (fee == null) return '—'
  return `$${fee.toLocaleString()}`
}

const EMPTY_FORM: Partial<Stallion> = {
  name: '', breed: '', discipline: 'thoroughbred_racing',
  studFee: undefined, studLocation: '', studBookingUrl: '',
  offspringCount: 0, offspringPerformanceSummary: '', registrationNumber: '',
  epdNotes: '', externalProfileUrl: '', pedigree: {},
}

export default function StallionManager() {
  const role = getTokenRole()
  if (role !== 'admin') return <p className="text-red-400 p-4">Access denied</p>
  return <StallionManagerInner />
}

function StallionManagerInner() {
  const qc = useQueryClient()
  const { data: stallions = [], isLoading, error } = useQuery({ queryKey: ['admin-stallions'], queryFn: listStallions })
  const [editTarget, setEditTarget] = useState<Stallion | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<Partial<Stallion>>(EMPTY_FORM)
  const [pedigreeText, setPedigreeText] = useState('{}')
  const [saving, setSaving] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const reviewMutation = useMutation({
    mutationFn: (id: string) => markReviewed(id),
    onMutate: async (id) => {
      setReviewingId(id)
      await qc.cancelQueries({ queryKey: ['admin-stallions'] })
      const prev = qc.getQueryData<Stallion[]>(['admin-stallions'])
      qc.setQueryData<Stallion[]>(['admin-stallions'], old =>
        (old ?? []).map(s => s.id === id ? { ...s, lastReviewedAt: new Date().toISOString() } : s)
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin-stallions'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-stallions'] })
      setReviewingId(null)
    },
  })

  const months = stallions.map(s => stalenessMonths(s))
  const needsReview = months.filter(m => m >= 12).length
  const reviewSoon = months.filter(m => m >= 6 && m < 12).length
  const upToDate = months.filter(m => m < 6).length

  const disciplineCounts = stallions.reduce<Record<string, number>>((acc, s) => {
    acc[s.discipline] = (acc[s.discipline] ?? 0) + 1
    return acc
  }, {})

  function openEdit(s: Stallion) {
    setEditTarget(s)
    setForm({ ...s })
    setPedigreeText(JSON.stringify(s.pedigree ?? {}, null, 2))
    setShowNew(false)
  }

  function openNew() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setPedigreeText('{}')
    setShowNew(true)
  }

  function closeModal() {
    setEditTarget(null)
    setShowNew(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      let pedigree: Record<string, unknown> = {}
      try { pedigree = JSON.parse(pedigreeText) } catch { /* keep empty */ }
      const payload = { ...form, pedigree }
      if (editTarget) {
        await updateStallion(editTarget.id, payload)
      } else {
        await createStallion(payload)
      }
      qc.invalidateQueries({ queryKey: ['admin-stallions'] })
      closeModal()
    } catch {
      alert('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <p className="text-gray-400 p-6">Loading…</p>
  if (error) return <p className="text-red-400 p-6">Failed to load stallions.</p>

  const modalOpen = editTarget !== null || showNew

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Stallion Catalog</h1>
        <button
          onClick={openNew}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
        >
          + Add Stallion
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-4">
          <p className="text-xs text-gray-400">Needs Review</p>
          <p className="text-2xl font-bold text-red-400">{needsReview}</p>
          <p className="text-xs text-gray-500">12+ months</p>
        </div>
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
          <p className="text-xs text-gray-400">Review Soon</p>
          <p className="text-2xl font-bold text-amber-400">{reviewSoon}</p>
          <p className="text-xs text-gray-500">6–12 months</p>
        </div>
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-4">
          <p className="text-xs text-gray-400">Up to Date</p>
          <p className="text-2xl font-bold text-emerald-400">{upToDate}</p>
          <p className="text-xs text-gray-500">Under 6 months</p>
        </div>
      </div>

      {/* Discipline breakdown */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(disciplineCounts).sort((a, b) => b[1] - a[1]).map(([disc, count]) => (
          <span key={disc} className="px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded-full border border-gray-700">
            {disc.replace(/_/g, ' ')} ({count})
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-800">
              <th className="px-4 py-3 w-6"></th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Breed</th>
              <th className="px-4 py-3">Discipline</th>
              <th className="px-4 py-3 text-right">Stud Fee</th>
              <th className="px-4 py-3 text-right">Offspring</th>
              <th className="px-4 py-3 text-right">Last Reviewed</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stallions.map((s, i) => {
              const m = months[i]
              return (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-4 py-3">
                    <span className={`w-2 h-2 rounded-full block ${stalenessDot(m)}`} />
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3 text-gray-300">{s.breed}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{s.discipline.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtFee(s.studFee)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{s.offspringCount}</td>
                  <td className={`px-4 py-3 text-right text-xs ${m >= 12 ? 'text-red-400' : m >= 6 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {fmtDate(s.lastReviewedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => reviewMutation.mutate(s.id)}
                        disabled={reviewingId === s.id}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded transition-colors"
                      >
                        {reviewingId === s.id ? '…' : 'Mark Reviewed'}
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="px-2 py-1 text-xs bg-indigo-900/50 hover:bg-indigo-800/50 text-indigo-300 rounded transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {stallions.length === 0 && (
          <p className="p-8 text-center text-gray-500 text-sm">No seed stallions found.</p>
        )}
      </div>

      {/* Edit / Add modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {editTarget ? `Edit — ${editTarget.name}` : 'Add Stallion'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name">
                  <input className={input} value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Breed">
                  <input className={input} value={form.breed ?? ''} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} />
                </Field>
              </div>
              <Field label="Discipline">
                <select className={input} value={form.discipline ?? 'other'} onChange={e => setForm(f => ({ ...f, discipline: e.target.value as Discipline }))}>
                  {DISCIPLINES.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Stud Fee ($)">
                  <input className={input} type="number" value={form.studFee ?? ''} onChange={e => setForm(f => ({ ...f, studFee: e.target.value ? parseInt(e.target.value) : null }))} />
                </Field>
                <Field label="Offspring Count">
                  <input className={input} type="number" value={form.offspringCount ?? 0} onChange={e => setForm(f => ({ ...f, offspringCount: parseInt(e.target.value) || 0 }))} />
                </Field>
              </div>
              <Field label="Stud Location">
                <input className={input} value={form.studLocation ?? ''} onChange={e => setForm(f => ({ ...f, studLocation: e.target.value }))} />
              </Field>
              <Field label="Booking URL">
                <input className={input} value={form.studBookingUrl ?? ''} onChange={e => setForm(f => ({ ...f, studBookingUrl: e.target.value }))} />
              </Field>
              <Field label="Registration Number">
                <input className={input} value={form.registrationNumber ?? ''} onChange={e => setForm(f => ({ ...f, registrationNumber: e.target.value }))} />
              </Field>
              <Field label="External Profile URL">
                <input className={input} value={form.externalProfileUrl ?? ''} onChange={e => setForm(f => ({ ...f, externalProfileUrl: e.target.value }))} />
              </Field>
              <Field label="Offspring Performance Summary">
                <textarea className={`${input} h-24 resize-none`} value={form.offspringPerformanceSummary ?? ''} onChange={e => setForm(f => ({ ...f, offspringPerformanceSummary: e.target.value }))} />
              </Field>
              <Field label="EPD Notes">
                <textarea className={`${input} h-20 resize-none`} value={form.epdNotes ?? ''} onChange={e => setForm(f => ({ ...f, epdNotes: e.target.value }))} />
              </Field>
              <Field label="Pedigree (JSON)">
                <textarea
                  className={`${input} h-32 resize-none font-mono text-xs`}
                  value={pedigreeText}
                  onChange={e => setPedigreeText(e.target.value)}
                />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

const input = 'w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500'
