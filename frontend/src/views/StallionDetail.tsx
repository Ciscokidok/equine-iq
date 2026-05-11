import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getStallion } from '@/api/stallions'
import GeneticRiskPanel from '@/components/GeneticRiskPanel'
import { stallionDataQuality } from '@/lib/dataQuality'
import { useStallionSaleStats } from '@/api/auctionSales'
import { getMares } from '@/api/mares'
import { createBooking } from '@/api/studBookings'
import { toast } from 'sonner'
import client from '@/api/client'
import {
  getRacingEarnings, saveRacingEarnings,
  getProductionCosts, addProductionCost, deleteProductionCost,
} from '@/api/analytics'

export default function StallionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [bookingMareId, setBookingMareId] = useState('')
  const [bookingDate, setBookingDate] = useState('')
  const [bookingNotes, setBookingNotes] = useState('')
  const [bookingPending, setBookingPending] = useState(false)

  const { data: mares = [] } = useQuery({ queryKey: ['mares'], queryFn: getMares })

  const handleBooking = async () => {
    if (!bookingMareId || !id) return
    setBookingPending(true)
    try {
      const result = await createBooking({
        mareId: bookingMareId,
        stallionId: id,
        scheduledDate: bookingDate || undefined,
        notes: bookingNotes || undefined,
      })
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
      } else {
        toast.success('Breeding booked successfully')
        setShowBookingModal(false)
        setBookingMareId('')
        setBookingDate('')
        setBookingNotes('')
        navigate('/my-bookings')
      }
    } catch {
      toast.error('Booking failed — please try again')
    } finally {
      setBookingPending(false)
    }
  }

  const { data: stallion, isLoading, isError } = useQuery({
    queryKey: ['stallion', id],
    queryFn: () => getStallion(id!),
  })

  const { data: saleStats } = useStallionSaleStats(id ?? '')
  const { data: saleHistory } = useQuery({
    queryKey: ['horse-sale-history', id],
    queryFn: () => client.get<{ records: Array<{ id: string; saleSource: string; saleSessionName: string | null; saleDate: string; hipNumber: string | null; hammerPriceCents: number; buyerName: string | null; consignorName: string | null }> }>(`/api/horses/${id}/sale-history`).then((r) => r.data),
    enabled: !!id,
  })
  const { data: earningsData, refetch: refetchEarnings } = useQuery({
    queryKey: ['racing-earnings', id],
    queryFn: () => getRacingEarnings(id!),
    enabled: !!id,
  })
  const { data: costsData, refetch: refetchCosts } = useQuery({
    queryKey: ['production-costs', id],
    queryFn: () => getProductionCosts(id!),
    enabled: !!id,
  })

  const saveEarnings = useMutation({
    mutationFn: (data: Parameters<typeof saveRacingEarnings>[1]) => saveRacingEarnings(id!, data),
    onSuccess: () => { refetchEarnings(); setEditingEarnings(false) },
  })
  const addCost = useMutation({
    mutationFn: (data: Parameters<typeof addProductionCost>[1]) => addProductionCost(id!, data),
    onSuccess: () => { refetchCosts(); setCostForm({ category: 'mare_care', amount: '', year: String(new Date().getFullYear()), notes: '' }) },
  })
  const removeCost = useMutation({
    mutationFn: deleteProductionCost,
    onSuccess: () => refetchCosts(),
  })

  const [editingEarnings, setEditingEarnings] = useState(false)
  const [earningsForm, setEarningsForm] = useState({ totalEarnings: '', starts: '', wins: '', places: '', shows: '', bestRaceClass: '', notes: '', sourceUrl: '' })
  const [costForm, setCostForm] = useState({ category: 'mare_care', amount: '', year: String(new Date().getFullYear()), notes: '' })
  const [showCostForm, setShowCostForm] = useState(false)

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>
  if (isError || !stallion) return <p className="text-sm text-red-500">Stallion not found.</p>

  const pedigree = stallion.pedigree as Record<string, any>
  const quality = stallionDataQuality(stallion)
  const registryLinks = [
    { label: 'AQHA', url: `https://www.aqha.com/horse-search?q=${encodeURIComponent(stallion.name)}`, disciplines: ['quarter_horse', 'paint', 'reining', 'cutting', 'barrel_racing'] },
    { label: 'KWPN', url: `https://www.kwpn.nl/paard/search?q=${encodeURIComponent(stallion.name)}`, disciplines: ['warmblood', 'sport_horse', 'dressage', 'hunter_jumper', 'eventing'] },
    { label: 'NRHA', url: `https://www.nrha.com/index.php?option=com_horses&task=search&q=${encodeURIComponent(stallion.name)}`, disciplines: ['reining'] },
    { label: 'USEF', url: `https://www.usef.org/search#q=${encodeURIComponent(stallion.name)}&t=Horse`, disciplines: ['dressage', 'hunter_jumper', 'eventing', 'sport_horse'] },
  ].filter((r) => r.disciplines.includes(stallion.discipline))

  const inquiryBody = encodeURIComponent(
    `Hello,\n\nI am interested in breeding services for ${stallion.name}.\n\nPlease provide availability and pricing information.\n\nThank you.`,
  )
  const inquirySubject = encodeURIComponent(`Breeding Inquiry: ${stallion.name}`)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold">{stallion.name}</h1>
            <p className="text-stone-500">
              {stallion.breed} · {stallion.discipline.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <Link
          to={`/horses/${id}/pedigree`}
          className="border border-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-50"
        >
          Pedigree Tree
        </Link>
      </div>

      {/* In-app stud fee booking */}
      {stallion.studFee != null && (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-800">Stud Fee</p>
            <p className="text-xl font-bold text-brand-800">
              {stallion.studFee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </p>
          </div>
          <button
            onClick={() => setShowBookingModal(true)}
            className="bg-brand-700 text-white px-5 py-2.5 rounded text-sm font-medium hover:bg-brand-900"
          >
            Book Breeding
          </button>
        </div>
      )}

      {/* External booking / inquiry */}
      {(stallion.studBookingUrl || stallion.studLocation) && (
        <div className="flex flex-wrap gap-3">
          {stallion.studBookingUrl && (
            <a
              href={stallion.studBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50"
            >
              External Booking Site →
            </a>
          )}
          {stallion.studLocation && (
            <a
              href={`mailto:?subject=${inquirySubject}&body=${inquiryBody}`}
              className="border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50"
            >
              Send Inquiry Email
            </a>
          )}
        </div>
      )}

      {/* Booking modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Book Breeding — {stallion.name}</h2>
            <p className="text-sm text-stone-500">
              Stud fee:{' '}
              <span className="font-medium text-stone-800">
                {(stallion.studFee ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </span>
            </p>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Select Your Mare *</label>
              <select
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                value={bookingMareId}
                onChange={(e) => setBookingMareId(e.target.value)}
              >
                <option value="">Choose a mare…</option>
                {mares.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Preferred Date (optional)</label>
              <input
                type="date"
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Notes (optional)</label>
              <textarea
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                rows={2}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowBookingModal(false); setBookingMareId(''); setBookingDate(''); setBookingNotes('') }}
                className="flex-1 border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={!bookingMareId || bookingPending}
                className="flex-1 bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-brand-900 disabled:opacity-50"
              >
                {bookingPending ? 'Processing…' : 'Pay & Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data quality + registry links */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${quality.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' : quality.tier === 'silver' ? 'bg-stone-100 text-stone-600' : 'bg-orange-100 text-orange-700'}`}>
          {quality.tier === 'gold' ? '🥇' : quality.tier === 'silver' ? '🥈' : '🥉'} {quality.tier} data ({quality.score}/{quality.max})
        </span>
        {registryLinks.map((r) => (
          <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
            className="text-xs border border-stone-200 px-2 py-0.5 rounded hover:bg-stone-50 text-stone-600">
            Look up on {r.label} →
          </a>
        ))}
      </div>

      {/* Details */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 grid sm:grid-cols-2 gap-3 text-sm">
        {stallion.studFee != null && (
          <div>
            <span className="text-stone-400">Stud Fee:</span>{' '}
            <span className="font-medium">${stallion.studFee.toLocaleString()}</span>
          </div>
        )}
        {stallion.studLocation && (
          <div>
            <span className="text-stone-400">Location:</span>{' '}
            <span className="font-medium">{stallion.studLocation}</span>
          </div>
        )}
        {stallion.offspringCount > 0 && (
          <div>
            <span className="text-stone-400">Offspring:</span>{' '}
            <span className="font-medium">{stallion.offspringCount.toLocaleString()}</span>
          </div>
        )}
        {stallion.color && (
          <div>
            <span className="text-stone-400">Color:</span>{' '}
            <span className="font-medium">{stallion.color}</span>
          </div>
        )}
        {stallion.heightHands && (
          <div>
            <span className="text-stone-400">Height:</span>{' '}
            <span className="font-medium">{stallion.heightHands} hh</span>
          </div>
        )}
        {stallion.registrationNumber && (
          <div>
            <span className="text-stone-400">Registration #:</span>{' '}
            <span className="font-medium font-mono">{stallion.registrationNumber}</span>
          </div>
        )}
        {stallion.externalProfileUrl && (
          <div className="sm:col-span-2">
            <a href={stallion.externalProfileUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand-700 hover:underline">
              View official registry profile →
            </a>
          </div>
        )}
      </div>

      {stallion.offspringPerformanceSummary && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Offspring Performance</h2>
          <p className="text-sm text-stone-700 whitespace-pre-line">
            {stallion.offspringPerformanceSummary}
          </p>
        </div>
      )}

      {stallion.epdNotes && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">EPD / Breeding Values</h2>
          <p className="text-sm text-stone-700 whitespace-pre-line">{stallion.epdNotes}</p>
          <p className="text-xs text-stone-400 mt-2 italic">Source: manually entered from registry records. Verify against official studbook before breeding decisions.</p>
        </div>
      )}

      {stallion.conformationNotes && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Conformation Notes</h2>
          <p className="text-sm text-stone-700">{stallion.conformationNotes}</p>
        </div>
      )}

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

      {/* Progeny Sale Stats */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Progeny Sale Stats</h2>
        {!saleStats || saleStats.count === 0 ? (
          <p className="text-sm text-stone-400">No auction data recorded.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {([['Avg', saleStats.avg], ['Median', saleStats.median], ['High', saleStats.high], ['Low', saleStats.low]] as [string, number | null][]).map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-stone-400">{label}</p>
                  <p className="font-medium">{val != null ? val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-2">{saleStats.count} sale{saleStats.count !== 1 ? 's' : ''} recorded</p>
            {saleStats.lowSampleWarning && (
              <p className="text-xs text-yellow-600 mt-1">Low sample — fewer than 3 sales</p>
            )}
          </>
        )}
      </div>

      {/* Sale History from imports */}
      {saleHistory && saleHistory.records.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Sale History</h2>
          <div className="space-y-2">
            {saleHistory.records.map((r) => (
              <div key={r.id} className="flex flex-wrap gap-x-6 gap-y-1 text-sm border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="text-xs text-stone-400">Date </span>
                  <span>{new Date(r.saleDate).toLocaleDateString()}</span>
                </div>
                {r.saleSessionName && (
                  <div>
                    <span className="text-xs text-stone-400">Sale </span>
                    <span>{r.saleSessionName}</span>
                  </div>
                )}
                {r.hipNumber && (
                  <div>
                    <span className="text-xs text-stone-400">Hip </span>
                    <span>#{r.hipNumber}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-stone-400">Price </span>
                  <span className="font-medium">
                    {r.hammerPriceCents > 0
                      ? (r.hammerPriceCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                      : 'N/A'}
                  </span>
                </div>
                {r.buyerName && (
                  <div>
                    <span className="text-xs text-stone-400">Buyer </span>
                    <span>{r.buyerName}</span>
                  </div>
                )}
                {r.consignorName && (
                  <div>
                    <span className="text-xs text-stone-400">Consignor </span>
                    <span>{r.consignorName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Racing Earnings */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Racing Earnings</h2>
          <button onClick={() => {
            const e = earningsData?.earnings
            setEarningsForm({
              totalEarnings: e ? String(e.totalEarningsCents / 100) : '',
              starts: e?.starts != null ? String(e.starts) : '',
              wins: e?.wins != null ? String(e.wins) : '',
              places: e?.places != null ? String(e.places) : '',
              shows: e?.shows != null ? String(e.shows) : '',
              bestRaceClass: e?.bestRaceClass ?? '',
              notes: e?.notes ?? '',
              sourceUrl: e?.sourceUrl ?? '',
            })
            setEditingEarnings(true)
          }} className="text-xs text-stone-500 hover:text-stone-700 border border-stone-200 px-2 py-1 rounded">
            {earningsData?.earnings ? 'Edit' : '+ Add'}
          </button>
        </div>
        {earningsData?.earnings ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-stone-400">Career Earnings</p>
              <p className="text-base font-semibold text-stone-900">
                {(earningsData.earnings.totalEarningsCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </p>
            </div>
            {earningsData.earnings.starts != null && (
              <div>
                <p className="text-xs text-stone-400">Record</p>
                <p className="text-sm text-stone-700">
                  {earningsData.earnings.starts}-{earningsData.earnings.wins ?? '?'}-{earningsData.earnings.places ?? '?'}-{earningsData.earnings.shows ?? '?'}
                </p>
              </div>
            )}
            {earningsData.earnings.bestRaceClass && (
              <div>
                <p className="text-xs text-stone-400">Best Class</p>
                <p className="text-sm text-stone-700">{earningsData.earnings.bestRaceClass}</p>
              </div>
            )}
            {earningsData.earnings.sourceUrl && (
              <div>
                <p className="text-xs text-stone-400">Source</p>
                <a href={earningsData.earnings.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">Equibase ↗</a>
              </div>
            )}
            {earningsData.earnings.notes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-stone-400">Notes</p>
                <p className="text-sm text-stone-600">{earningsData.earnings.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-400 italic">No racing earnings recorded.</p>
        )}
        {editingEarnings && (
          <div className="pt-3 border-t border-stone-100 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Career Earnings ($)</label>
                <input type="number" value={earningsForm.totalEarnings} onChange={e => setEarningsForm(f => ({ ...f, totalEarnings: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="e.g. 2000000" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Starts</label>
                <input type="number" value={earningsForm.starts} onChange={e => setEarningsForm(f => ({ ...f, starts: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Wins</label>
                <input type="number" value={earningsForm.wins} onChange={e => setEarningsForm(f => ({ ...f, wins: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Places / Shows</label>
                <div className="flex gap-1">
                  <input type="number" value={earningsForm.places} onChange={e => setEarningsForm(f => ({ ...f, places: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="2nd" />
                  <input type="number" value={earningsForm.shows} onChange={e => setEarningsForm(f => ({ ...f, shows: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="3rd" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Best Race Class</label>
                <input type="text" value={earningsForm.bestRaceClass} onChange={e => setEarningsForm(f => ({ ...f, bestRaceClass: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="e.g. Grade I" />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className="block text-xs text-stone-500 mb-1">Equibase / Source URL</label>
                <input type="text" value={earningsForm.sourceUrl} onChange={e => setEarningsForm(f => ({ ...f, sourceUrl: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="https://equibase.com/..." />
              </div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Notes</label>
              <input type="text" value={earningsForm.notes} onChange={e => setEarningsForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveEarnings.mutate({
                  totalEarningsCents: Math.round((parseFloat(earningsForm.totalEarnings) || 0) * 100),
                  starts: earningsForm.starts ? parseInt(earningsForm.starts) : undefined,
                  wins: earningsForm.wins ? parseInt(earningsForm.wins) : undefined,
                  places: earningsForm.places ? parseInt(earningsForm.places) : undefined,
                  shows: earningsForm.shows ? parseInt(earningsForm.shows) : undefined,
                  bestRaceClass: earningsForm.bestRaceClass || undefined,
                  notes: earningsForm.notes || undefined,
                  sourceUrl: earningsForm.sourceUrl || undefined,
                })}
                disabled={saveEarnings.isPending}
                className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded hover:bg-stone-900 disabled:opacity-40"
              >
                {saveEarnings.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingEarnings(false)} className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Production Costs */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Production Costs</h2>
          <button onClick={() => setShowCostForm(v => !v)} className="text-xs text-stone-500 hover:text-stone-700 border border-stone-200 px-2 py-1 rounded">
            {showCostForm ? 'Cancel' : '+ Add Cost'}
          </button>
        </div>
        {showCostForm && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Category</label>
              <select value={costForm.category} onChange={e => setCostForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm">
                <option value="mare_care">Mare care</option>
                <option value="vet">Veterinary</option>
                <option value="foaling">Foaling</option>
                <option value="training">Training</option>
                <option value="transport">Transport</option>
                <option value="insurance">Insurance</option>
                <option value="stud_fee">Stud fee paid</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Amount ($)</label>
              <input type="number" value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="e.g. 8000" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Year</label>
              <input type="number" value={costForm.year} onChange={e => setCostForm(f => ({ ...f, year: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Notes</label>
              <input type="text" value={costForm.notes} onChange={e => setCostForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" placeholder="Optional" />
            </div>
            <div className="col-span-2 sm:col-span-4">
              <button
                onClick={() => addCost.mutate({ category: costForm.category, amountCents: Math.round((parseFloat(costForm.amount) || 0) * 100), year: parseInt(costForm.year), notes: costForm.notes || undefined })}
                disabled={!costForm.amount || addCost.isPending}
                className="px-3 py-1.5 bg-stone-800 text-white text-sm rounded hover:bg-stone-900 disabled:opacity-40"
              >
                {addCost.isPending ? 'Adding…' : 'Add Cost'}
              </button>
            </div>
          </div>
        )}
        {costsData && costsData.costs.length > 0 ? (
          <div className="space-y-2">
            {costsData.costs.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm py-1 border-t border-stone-100">
                <div>
                  <span className="font-medium text-stone-700 capitalize">{c.category.replace('_', ' ')}</span>
                  <span className="text-stone-400 ml-2">· {c.year}</span>
                  {c.notes && <span className="text-stone-400 ml-2 text-xs">{c.notes}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-stone-900">
                    {(c.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                  </span>
                  <button onClick={() => removeCost.mutate(c.id)} className="text-stone-300 hover:text-red-400 text-xs">✕</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-stone-200 font-semibold text-sm">
              <span>Total</span>
              <span>{(costsData.totalCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span>
            </div>
            {saleHistory && saleHistory.records.length > 0 && costsData.totalCents > 0 && (
              <div className="pt-2 border-t border-stone-100">
                {(() => {
                  const lastSale = saleHistory.records[0]
                  const profit = lastSale.hammerPriceCents - costsData.totalCents
                  const positive = profit >= 0
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Est. P&L (last sale − total costs)</span>
                      <span className={`font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {positive ? '+' : ''}{(profit / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-400 italic">No costs recorded. Add mare care, vet, foaling, and other expenses to calculate P&L.</p>
        )}
      </div>

      <GeneticRiskPanel mareBreed="" stallionBreed={stallion.breed} discipline={stallion.discipline} />
    </div>
  )
}
