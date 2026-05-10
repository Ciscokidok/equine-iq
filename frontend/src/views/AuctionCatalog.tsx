import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuctionCatalog, type AuctionCatalogFilters } from '@/api/auctions'

const DISCIPLINES = [
  '', 'sport_horse', 'warmblood', 'quarter_horse', 'paint', 'reining', 'cutting',
  'barrel_racing', 'flat_racing', 'thoroughbred_racing', 'hunter_jumper', 'dressage', 'eventing', 'other',
]

function usd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function timeLeft(endsAt: string, startAt: string, status: string): string {
  if (status === 'scheduled') return `Starts ${new Date(startAt).toLocaleDateString()}`
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function AuctionCatalog() {
  const navigate = useNavigate()
  const [breed, setBreed] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [status, setStatus] = useState('')

  const filters: AuctionCatalogFilters = {
    ...(breed && { breed }),
    ...(discipline && { discipline }),
    ...(status && { status }),
  }

  const { data: auctions = [], isLoading } = useAuctionCatalog(filters)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Auction Catalog</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/my-bids')}
            className="text-sm px-3 py-1.5 rounded border border-stone-300 hover:bg-stone-50 transition-colors"
          >
            My Bids
          </button>
          <button
            onClick={() => navigate('/my-listings')}
            className="text-sm px-3 py-1.5 rounded border border-stone-300 hover:bg-stone-50 transition-colors"
          >
            My Listings
          </button>
          <button
            onClick={() => navigate('/auctions/create')}
            className="text-sm px-3 py-1.5 rounded bg-brand-800 text-white hover:bg-brand-700 transition-colors"
          >
            List a Horse
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          className="input w-44"
          placeholder="Breed…"
        />
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="input">
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>{d ? d.replace(/_/g, ' ') : 'All disciplines'}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-stone-400">Loading…</p>
      ) : auctions.length === 0 ? (
        <p className="text-stone-400">No auctions match your filters</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {auctions.map((a) => (
            <Link
              key={a.id}
              to={`/auctions/${a.id}`}
              className="block border border-stone-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="font-semibold text-sm truncate">{a.horse?.name ?? 'Unknown Horse'}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ml-2 shrink-0 ${
                    a.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {a.status === 'open' ? 'Open' : 'Scheduled'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mb-3">
                {a.horse?.breed} · {a.horse?.discipline?.replace(/_/g, ' ')}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{usd(a.currentBid > 0 ? a.currentBid : a.startingBid)}</span>
                <span className="text-stone-400 text-xs">{timeLeft(a.endsAt, a.startAt, a.status)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
