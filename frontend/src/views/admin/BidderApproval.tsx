import { usePendingBidders, useApproveBidder, useSuspendBidder, useConfirmDeposit } from '@/api/auctions'

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

interface PendingBidder {
  id: string
  status: string
  depositConfirmedAt: string | null
  user?: { name: string; email: string } | null
  guestBidder?: { email: string; farmName: string | null } | null
}

export default function BidderApproval() {
  const role = getTokenRole()
  if (role !== 'admin') return <p>Access denied</p>

  return <BidderApprovalInner />
}

function BidderApprovalInner() {
  const { data, isLoading, error } = usePendingBidders()
  const approve = useApproveBidder()
  const suspend = useSuspendBidder()
  const confirmDeposit = useConfirmDeposit()

  if (isLoading) return <p>Loading pending bidders…</p>
  if (error) return <p>Error loading bidders.</p>

  const bidders: PendingBidder[] = data ?? []

  if (bidders.length === 0) return <p>No pending bidder approvals.</p>

  const getName = (b: PendingBidder) =>
    b.user?.name ?? b.guestBidder?.farmName ?? '—'
  const getEmail = (b: PendingBidder) =>
    b.user?.email ?? b.guestBidder?.email ?? '—'
  const getType = (b: PendingBidder) =>
    b.user ? 'Registered User' : 'Guest Bidder'

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Bidder Approvals</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Name</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Email</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Type</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Deposit</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ccc' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bidders.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{getName(b)}</td>
              <td style={{ padding: '0.5rem' }}>{getEmail(b)}</td>
              <td style={{ padding: '0.5rem' }}>{getType(b)}</td>
              <td style={{ padding: '0.5rem' }}>
                {b.depositConfirmedAt
                  ? `Confirmed ${new Date(b.depositConfirmedAt).toLocaleDateString()}`
                  : 'Pending'}
              </td>
              <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                {!b.depositConfirmedAt && (
                  <button
                    onClick={() => confirmDeposit.mutate(b.id)}
                    disabled={confirmDeposit.isPending}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                  >
                    Confirm Deposit
                  </button>
                )}
                <button
                  onClick={() => approve.mutate(b.id)}
                  disabled={approve.isPending}
                  style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Suspend this bidder? They will be unable to place bids immediately.')) {
                      suspend.mutate(b.id)
                    }
                  }}
                  disabled={suspend.isPending}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                >
                  Suspend
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
