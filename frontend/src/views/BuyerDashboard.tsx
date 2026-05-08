import { Link } from 'react-router-dom'
import { useMyBids } from '@/api/auctions'

function usd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function BuyerDashboard() {
  const { data, isLoading } = useMyBids()

  if (isLoading) return <p className="text-stone-400">Loading…</p>
  if (!data || data.bids.length === 0) {
    return <p className="text-stone-400">No bids yet. <Link to="/auctions" className="text-brand-700 underline">Browse auctions</Link>.</p>
  }

  const { bids, autoBids } = data
  const autoBidMap = Object.fromEntries(autoBids.map((ab) => [ab.auctionId, ab]))

  const active = bids.filter((b) => b.auctionStatus === 'open')
  const won = bids.filter((b) => b.bidStatus === 'won')
  const history = bids.filter((b) => b.auctionStatus !== 'open' && b.bidStatus !== 'won')

  function BidRow({ b }: { b: typeof bids[0] }) {
    const auto = autoBidMap[b.auctionId]
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white">
        <div>
          <Link to={`/auctions/${b.auctionId}`} className="text-sm font-medium text-brand-700 hover:underline">
            {b.horseName ?? 'Unknown Horse'}
          </Link>
          {auto && (
            <p className="text-xs text-stone-400">Auto-bid max: {usd(auto.autoMaxAmount ?? 0)}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{usd(b.currentBid)}</span>
          {b.bidStatus === 'winning' && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 font-medium">Winning</span>
          )}
          {b.bidStatus === 'outbid' && (
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-medium">Outbid</span>
          )}
          {b.bidStatus === 'outbid' && (
            <Link to={`/auctions/${b.auctionId}`} className="text-xs text-brand-700 underline">Bid Again</Link>
          )}
          {b.bidStatus === 'won' && (
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">Won</span>
          )}
          {b.bidStatus === 'closed' && (
            <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-600">Closed</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">My Bids</h1>

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Active Bids</h2>
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
            {active.map((b) => <BidRow key={b.auctionId} b={b} />)}
          </div>
        </section>
      )}

      {won.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Won</h2>
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
            {won.map((b) => <BidRow key={b.auctionId} b={b} />)}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">History</h2>
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
            {history.map((b) => <BidRow key={b.auctionId} b={b} />)}
          </div>
        </section>
      )}
    </div>
  )
}
