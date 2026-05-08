import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMares } from '@/api/mares'
import {
  getFoals,
  createFoal,
  deleteFoal,
  addFoalResult,
} from '@/api/foals'
import type { Foal, CreateFoalData, CreateFoalResultData } from '@/api/foals'
import { useAuctionSales, useAddAuctionSale } from '@/api/auctionSales'
import { toast } from 'sonner'

const SALE_TYPES = ['weanling', 'yearling', 'two_year_old_in_training', 'mixed_age'] as const

function AuctionSalesSection({ foalId }: { foalId: string }) {
  const { data: sales = [] } = useAuctionSales(foalId)
  const addSale = useAddAuctionSale()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ salePrice: '', saleDate: '', saleType: 'weanling' as typeof SALE_TYPES[number], auctionHouse: '', hipNumber: '', buyer: '', notes: '' })

  const handleSubmit = () => {
    const price = parseFloat(form.salePrice)
    if (!form.saleDate || !form.saleType || isNaN(price) || price <= 0) { toast.error('Sale price, date, and type are required'); return }
    addSale.mutate({
      foalId,
      data: {
        salePrice: price,
        saleDate: form.saleDate,
        saleType: form.saleType,
        auctionHouse: form.auctionHouse || undefined,
        hipNumber: form.hipNumber || undefined,
        buyer: form.buyer || undefined,
        notes: form.notes || undefined,
      },
    }, {
      onSuccess: () => {
        setForm({ salePrice: '', saleDate: '', saleType: 'weanling', auctionHouse: '', hipNumber: '', buyer: '', notes: '' })
        setShowForm(false)
      },
    })
  }

  return (
    <div className="mt-3 border-t border-stone-100 pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-stone-600">Auction Sales</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs border border-stone-200 px-2 py-0.5 rounded hover:bg-stone-50"
        >
          {showForm ? 'Cancel' : '+ Record Sale'}
        </button>
      </div>

      {sales.length === 0 && !showForm && (
        <p className="text-xs text-stone-400">No sales recorded. Use "Record Sale" to log an auction result.</p>
      )}

      {sales.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-stone-400">
              <th className="text-left py-1">Date</th>
              <th className="text-left py-1">Price</th>
              <th className="text-left py-1">Type</th>
              <th className="text-left py-1">House</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-stone-50">
                <td className="py-1">{new Date(s.saleDate).toLocaleDateString()}</td>
                <td className="py-1">{s.salePrice.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</td>
                <td className="py-1">{s.saleType.replace(/_/g, ' ')}</td>
                <td className="py-1">{s.auctionHouse ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Sale Price ($) *</label>
            <input type="number" className="input w-full" value={form.salePrice} onChange={(e) => setForm((p) => ({ ...p, salePrice: e.target.value }))} placeholder="e.g. 25000" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Sale Date *</label>
            <input type="date" className="input w-full" value={form.saleDate} onChange={(e) => setForm((p) => ({ ...p, saleDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Sale Type *</label>
            <select className="input w-full" value={form.saleType} onChange={(e) => setForm((p) => ({ ...p, saleType: e.target.value as typeof SALE_TYPES[number] }))}>
              {SALE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Auction House</label>
            <input className="input w-full" value={form.auctionHouse} onChange={(e) => setForm((p) => ({ ...p, auctionHouse: e.target.value }))} placeholder="e.g. Keeneland" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Hip #</label>
            <input className="input w-full" value={form.hipNumber} onChange={(e) => setForm((p) => ({ ...p, hipNumber: e.target.value }))} placeholder="e.g. 342" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-0.5">Buyer</label>
            <input className="input w-full" value={form.buyer} onChange={(e) => setForm((p) => ({ ...p, buyer: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <button
              onClick={handleSubmit}
              disabled={!form.salePrice || !form.saleDate || addSale.isPending}
              className="bg-brand-700 text-white px-3 py-1.5 rounded text-xs hover:bg-brand-900 disabled:opacity-50"
            >
              {addSale.isPending ? 'Saving…' : 'Save Sale'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FoalCard({ foal }: { foal: Foal }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showResultForm, setShowResultForm] = useState(false)
  const [resultData, setResultData] = useState<CreateFoalResultData>({
    event: '',
    eventDate: '',
    placement: '',
    notes: '',
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteFoal(foal.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['foals'] }); toast.success('Foal deleted') },
    onError: () => toast.error('Delete failed'),
  })

  const addResultMutation = useMutation({
    mutationFn: () => addFoalResult(foal.id, {
      ...resultData,
      placement: resultData.placement || undefined,
      notes: resultData.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foals'] })
      toast.success('Result added')
      setResultData({ event: '', eventDate: '', placement: '', notes: '' })
      setShowResultForm(false)
    },
    onError: () => toast.error('Failed to add result'),
  })

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{foal.name ?? 'Unnamed foal'}</p>
          <p className="text-xs text-stone-400">
            {foal.mare.name}
            {foal.stallion ? ` × ${foal.stallion.name}` : ''}
            {foal.foaledAt ? ` · ${new Date(foal.foaledAt).toLocaleDateString()}` : ''}
            {foal.sex ? ` · ${foal.sex}` : ''}
            {foal.color ? ` · ${foal.color}` : ''}
          </p>
          {foal.notes && <p className="text-xs text-stone-500 mt-1">{foal.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-stone-400 hover:text-stone-700"
          >
            {expanded ? 'Hide' : `Results (${foal.results.length})`}
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-stone-100 pt-3 space-y-3">
          {foal.results.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-400">
                  <th className="text-left py-1">Event</th>
                  <th className="text-left py-1">Date</th>
                  <th className="text-left py-1">Placement</th>
                  <th className="text-left py-1">Score</th>
                  <th className="text-left py-1">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {foal.results.map((r) => (
                  <tr key={r.id} className="border-t border-stone-50">
                    <td className="py-1">{r.event}</td>
                    <td className="py-1">{new Date(r.eventDate).toLocaleDateString()}</td>
                    <td className="py-1">{r.placement ?? '—'}</td>
                    <td className="py-1">{r.score != null ? r.score : '—'}</td>
                    <td className="py-1">{r.earnings != null ? `$${r.earnings.toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-stone-400">No competition results yet.</p>
          )}

          <button
            onClick={() => setShowResultForm(!showResultForm)}
            className="text-xs border border-stone-200 px-2 py-1 rounded hover:bg-stone-50"
          >
            {showResultForm ? 'Cancel' : '+ Add Result'}
          </button>

          <AuctionSalesSection foalId={foal.id} />

          {showResultForm && (
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-stone-500 mb-0.5">Event *</label>
                <input
                  className="input w-full"
                  value={resultData.event}
                  onChange={(e) => setResultData((p) => ({ ...p, event: e.target.value }))}
                  placeholder="e.g. NRHA Futurity"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-0.5">Date *</label>
                <input
                  type="date"
                  className="input w-full"
                  value={resultData.eventDate}
                  onChange={(e) => setResultData((p) => ({ ...p, eventDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-0.5">Placement</label>
                <input
                  className="input w-full"
                  value={resultData.placement}
                  onChange={(e) => setResultData((p) => ({ ...p, placement: e.target.value }))}
                  placeholder="e.g. 1st"
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-0.5">Notes</label>
                <input
                  className="input w-full"
                  value={resultData.notes}
                  onChange={(e) => setResultData((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  onClick={() => addResultMutation.mutate()}
                  disabled={!resultData.event || !resultData.eventDate || addResultMutation.isPending}
                  className="bg-brand-700 text-white px-3 py-1.5 rounded text-xs hover:bg-brand-900 disabled:opacity-50"
                >
                  {addResultMutation.isPending ? 'Saving…' : 'Save Result'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_FOAL: CreateFoalData = { mareId: '', name: '', sex: '', foaledAt: '', color: '', notes: '' }

export default function FoalTracker() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateFoalData>(EMPTY_FOAL)

  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: getMares })
  const { data: foals = [], isLoading } = useQuery({ queryKey: ['foals'], queryFn: getFoals })

  const createMutation = useMutation({
    mutationFn: () => createFoal({
      ...form,
      name: form.name || undefined,
      sex: form.sex || undefined,
      foaledAt: form.foaledAt || undefined,
      color: form.color || undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['foals'] })
      toast.success('Foal recorded')
      setForm(EMPTY_FOAL)
      setShowForm(false)
    },
    onError: () => toast.error('Failed to record foal'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Foal Outcomes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900"
        >
          {showForm ? 'Cancel' : 'Record Foal'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-stone-200 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Record New Foal</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Mare *</label>
              <select
                className="input w-full"
                value={form.mareId}
                onChange={(e) => setForm((p) => ({ ...p, mareId: e.target.value }))}
              >
                <option value="">Select mare…</option>
                {mares.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Foal Name</label>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Sex</label>
              <select
                className="input w-full"
                value={form.sex}
                onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value }))}
              >
                <option value="">Unknown</option>
                <option value="mare">Filly</option>
                <option value="stallion">Colt</option>
                <option value="gelding">Gelding</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Foaled Date</label>
              <input
                type="date"
                className="input w-full"
                value={form.foaledAt}
                onChange={(e) => setForm((p) => ({ ...p, foaledAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Color</label>
              <input
                className="input w-full"
                value={form.color}
                onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                placeholder="e.g. Bay"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Notes</label>
              <input
                className="input w-full"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.mareId || createMutation.isPending}
            className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving…' : 'Save Foal'}
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-stone-400">Loading…</p>}

      {!isLoading && foals.length === 0 && (
        <p className="text-stone-400 text-sm">
          No foals recorded yet. Use "Record Foal" to track offspring outcomes.
        </p>
      )}

      <div className="space-y-3">
        {foals.map((foal) => (
          <FoalCard key={foal.id} foal={foal} />
        ))}
      </div>
    </div>
  )
}
