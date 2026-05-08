import { useState } from 'react'
import { useVettingQueue, useApproveVetting, useRejectVetting } from '@/api/auctions'
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

interface VettingDoc {
  id: string
  docType: string
  fileName: string
}

interface VettingListing {
  id: string
  horse: { name: string; breed: string } | null
  seller: { name: string; email: string } | null
  documents: VettingDoc[]
}

export default function VettingQueue() {
  const role = getTokenRole()
  if (role !== 'admin') return <p>Access denied</p>

  return <VettingQueueInner />
}

function VettingQueueInner() {
  const { data, isLoading, error } = useVettingQueue()
  const approve = useApproveVetting()
  const reject = useRejectVetting()
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})

  if (isLoading) return <p>Loading vetting queue…</p>
  if (error) return <p>Error loading queue.</p>

  const listings: VettingListing[] = data ?? []

  if (listings.length === 0) return <p>No listings pending vetting.</p>

  const openDoc = async (listingId: string, docId: string) => {
    try {
      const res = await client.get<{ url: string }>(`/api/listings/${listingId}/documents/${docId}/url`)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } catch {
      alert('Failed to get document URL.')
    }
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Vetting Queue</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Horse</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Seller</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Documents</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>
                {listing.horse?.name ?? '—'} ({listing.horse?.breed ?? '—'})
              </td>
              <td style={{ padding: '0.5rem' }}>
                {listing.seller?.name ?? '—'}<br />
                <small>{listing.seller?.email ?? ''}</small>
              </td>
              <td style={{ padding: '0.5rem' }}>
                {listing.documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => openDoc(listing.id, doc.id)}
                    style={{ marginRight: '0.5rem', marginBottom: '0.25rem' }}
                  >
                    Open {doc.docType}
                  </button>
                ))}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <button
                  onClick={() => approve.mutate(listing.id)}
                  disabled={approve.isPending}
                  style={{ marginRight: '0.5rem', background: '#22c55e', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                >
                  Approve
                </button>
                <input
                  type="text"
                  placeholder="Rejection reason"
                  value={rejectReasons[listing.id] ?? ''}
                  onChange={(e) => setRejectReasons((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                  style={{ marginRight: '0.25rem', padding: '0.25rem' }}
                />
                <button
                  onClick={() => {
                    const reason = rejectReasons[listing.id] ?? ''
                    if (!reason.trim()) { alert('Enter a rejection reason.'); return }
                    reject.mutate({ id: listing.id, reason })
                  }}
                  disabled={reject.isPending}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
