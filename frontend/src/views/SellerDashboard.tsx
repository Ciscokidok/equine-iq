import { Link } from 'react-router-dom'
import { useMyListingItems } from '@/api/auctions'

const STATUS_ORDER = ['open', 'scheduled', 'approved', 'pending_review', 'sold', 'passed']
const STATUS_LABELS: Record<string, string> = {
  open: 'Live',
  scheduled: 'Scheduled',
  approved: 'Ready to Configure',
  pending_review: 'Awaiting Vetting',
  sold: 'Sold',
  passed: 'Passed',
}
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  approved: 'bg-yellow-100 text-yellow-800',
  pending_review: 'bg-stone-100 text-stone-600',
  sold: 'bg-purple-100 text-purple-800',
  passed: 'bg-red-100 text-red-800',
}

function usd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function SellerDashboard() {
  const { data: listings = [], isLoading } = useMyListingItems()

  if (isLoading) return <p className="text-stone-400">Loading…</p>
  if (listings.length === 0) {
    return (
      <p className="text-stone-400">
        No listings yet.{' '}
        <Link to="/listings/new" className="text-brand-700 underline">
          Create one
        </Link>
        .
      </p>
    )
  }

  const groups = STATUS_ORDER.reduce<Record<string, typeof listings>>((acc, s) => {
    const items = listings.filter((l) => l.status === s)
    if (items.length) acc[s] = items
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">My Listings</h1>
      {STATUS_ORDER.filter((s) => groups[s]).map((status) => (
        <section key={status}>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            {STATUS_LABELS[status] ?? status}
            <span className="bg-stone-200 text-stone-600 rounded-full px-2 py-0.5 text-xs font-normal">
              {groups[status].length}
            </span>
          </h2>
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
            {groups[status].map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium">{l.horse?.name ?? 'Horse'}</p>
                  <p className="text-xs text-stone-400">{l.horse?.breed}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-stone-500">{l.bidCount != null ? `${l.bidCount} bids` : '—'}</span>
                  <span className="font-medium">
                    {l.currentHighBid != null ? usd(l.currentHighBid) : '—'}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[l.status] ?? 'bg-stone-100 text-stone-600'}`}
                  >
                    {STATUS_LABELS[l.status] ?? l.status}
                  </span>
                  {l.status === 'approved' && (
                    <Link to={`/listings/${l.id}/configure`} className="text-xs text-brand-700 underline">
                      Configure Auction
                    </Link>
                  )}
                  {l.status === 'open' && (
                    <Link to={`/auctions/${l.id}`} className="text-xs text-brand-700 underline">
                      View Live
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
