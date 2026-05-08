import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { io, type Socket } from 'socket.io-client'
import { useAuction, usePlaceBid, useBidderApproval } from '@/api/auctions'

function usd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtTime(seconds: number): string {
  if (seconds <= 0) return 'Ended'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = localStorage.getItem('auth_token')

  const { data: auction, isLoading } = useAuction(id!)
  const { data: approval } = useBidderApproval()
  const placeBid = usePlaceBid(id!)

  const [currentBid, setCurrentBid] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [liveHistory, setLiveHistory] = useState<{ currentBid: number }[]>([])
  const [bidAmount, setBidAmount] = useState('')
  const [bidError, setBidError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (auction) {
      setCurrentBid(auction.currentBid)
      setTimeRemaining(auction.timeRemainingSeconds)
    }
  }, [auction])

  useEffect(() => {
    if (!id) return
    const apiUrl = (import.meta.env.VITE_API_URL as string) ?? ''
    const socket = io(apiUrl, { auth: { token: token ?? '' } })
    socketRef.current = socket

    socket.emit('join-auction', id)

    socket.on('bid', (data: { currentBid: number; timeRemainingSeconds: number }) => {
      setCurrentBid(data.currentBid)
      setTimeRemaining(data.timeRemainingSeconds)
      setLiveHistory((prev) => [data, ...prev].slice(0, 10))
    })

    return () => {
      socket.emit('leave-auction', id)
      socket.disconnect()
    }
  }, [id, token])

  if (isLoading || !auction) return <p className="text-stone-400">Loading…</p>

  const effectiveBid = currentBid ?? auction.currentBid
  const minNextBid = effectiveBid > 0 ? effectiveBid + auction.bidIncrement : auction.startingBid

  async function handleBid(e: React.FormEvent) {
    e.preventDefault()
    setBidError(null)
    try {
      await placeBid.mutateAsync({ amount: parseInt(bidAmount, 10) })
      setBidAmount('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Bid failed'
      setBidError(msg)
    }
  }

  let bidSection: React.ReactNode

  if (!token) {
    bidSection = (
      <div className="bg-stone-50 rounded-lg p-4 text-center space-y-2">
        <p className="text-sm text-stone-600">Sign in or register as a guest to bid</p>
        <div className="flex justify-center gap-3">
          <Link to="/login" className="text-sm text-brand-700 underline">Sign in</Link>
          <Link to="/register" className="text-sm text-brand-700 underline">Register</Link>
        </div>
      </div>
    )
  } else if (!approval?.status || approval.status === 'pending') {
    bidSection = (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-1">
        <p className="font-medium text-sm text-yellow-800">
          {approval?.status === 'pending' ? 'Awaiting approval' : 'Apply to bid'}
        </p>
        <p className="text-xs text-yellow-700">
          Participation requires a refundable deposit and identity verification.
          Wire transfer instructions will be provided on approval. Contact{' '}
          <a href="mailto:bidders@equineiq.com" className="underline">bidders@equineiq.com</a> to get started.
        </p>
      </div>
    )
  } else if (approval.status === 'suspended') {
    bidSection = (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">Your bidder account has been suspended.</p>
      </div>
    )
  } else {
    bidSection = (
      <form onSubmit={handleBid} className="space-y-3">
        <div>
          <label className="text-xs text-stone-500 block mb-1">
            Bid amount — minimum {usd(minNextBid)}
          </label>
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="input w-full"
            placeholder={String(minNextBid)}
            min={minNextBid}
            step={auction.bidIncrement}
          />
        </div>
        {bidError && <p className="text-xs text-red-600">{bidError}</p>}
        <button
          type="submit"
          disabled={placeBid.isPending}
          className="w-full bg-brand-700 text-white py-2 rounded text-sm font-medium hover:bg-brand-900 disabled:opacity-50"
        >
          {placeBid.isPending ? 'Placing…' : 'Place Bid'}
        </button>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-stone-500 hover:text-stone-900">
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Horse Passport */}
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{auction.horse?.name ?? 'Unknown Horse'}</h1>
            <p className="text-stone-500">
              {auction.horse?.breed} · {auction.horse?.discipline?.replace(/_/g, ' ')}
            </p>
          </div>

          {auction.horse?.conformationNotes && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Conformation Notes</h3>
              <p className="text-sm text-stone-600">{auction.horse.conformationNotes}</p>
            </div>
          )}

          {auction.horse?.pedigree && Object.keys(auction.horse.pedigree).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Pedigree</h3>
              <pre className="text-xs bg-stone-50 p-3 rounded overflow-auto whitespace-pre-wrap">
                {JSON.stringify(auction.horse.pedigree, null, 2)}
              </pre>
            </div>
          )}

          {auction.documents.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Documents</h3>
              <ul className="space-y-1">
                {auction.documents.map((doc, i) => (
                  <li key={i}>
                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 underline">
                      {doc.docType.replace(/_/g, ' ')} — {doc.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Live Bidding */}
        <div className="space-y-4">
          <div className="bg-stone-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-stone-500">Current Bid</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${auction.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                {auction.status}
              </span>
            </div>
            <p className="text-3xl font-bold">
              {usd(effectiveBid > 0 ? effectiveBid : auction.startingBid)}
            </p>
            {auction.status === 'open' && timeRemaining > 0 && (
              <p className="text-xs text-stone-400 mt-1">{fmtTime(timeRemaining)} remaining</p>
            )}
          </div>

          {auction.status === 'open' && bidSection}

          {liveHistory.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Live Activity</h3>
              <ul className="text-xs text-stone-500 space-y-0.5">
                {liveHistory.map((b, i) => (
                  <li key={i}>New bid: {usd(b.currentBid)}</li>
                ))}
              </ul>
            </div>
          )}

          {auction.bids.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Bid History</h3>
              <ul className="divide-y divide-stone-100 text-xs">
                {auction.bids.map((b, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span className="text-stone-400">{b.bidderInitials}</span>
                    <span className="font-medium">{usd(b.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
