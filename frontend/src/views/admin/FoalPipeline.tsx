import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import client from '@/api/client'

function getTokenRole(): string | null {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role ?? null
  } catch { return null }
}

function daysAgo(date: string) {
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
  return d === 0 ? 'today' : `${d}d ago`
}

function OwnerTag({ user }: { user: { email: string; name?: string | null } }) {
  return (
    <p className="text-xs text-stone-400 truncate" title={user.email}>
      {user.name ?? user.email}
    </p>
  )
}

interface StageColumnProps {
  title: string
  color: string
  items: React.ReactNode[]
}

function StageColumn({ title, color, items }: StageColumnProps) {
  return (
    <div className="flex-shrink-0 w-64">
      <div className={`flex items-center gap-2 mb-3 px-1`}>
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{title}</h3>
        <span className="ml-auto bg-stone-100 text-stone-500 text-xs rounded-full px-2 py-0.5 font-medium">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-stone-300 px-1">None</p>
        ) : items}
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-1 text-sm shadow-sm">
      {children}
    </div>
  )
}

export default function FoalPipeline() {
  const role = getTokenRole()
  if (role !== 'admin') return <p className="text-red-500">Access denied</p>
  return <FoalPipelineInner />
}

function FoalPipelineInner() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'foal-pipeline'],
    queryFn: () => client.get('/api/admin/foal-pipeline').then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return <p className="text-stone-400">Loading pipeline…</p>
  if (error) return <p className="text-red-500">Failed to load pipeline</p>

  const s = data.stages

  const col1 = (s.breeding_confirmed ?? []).map((b: any) => (
    <Card key={b.id}>
      <p className="font-medium truncate">{b.mare.name} × {b.stallion.name}</p>
      <OwnerTag user={b.user} />
      <p className="text-xs text-stone-400">Booked {daysAgo(b.createdAt)}</p>
    </Card>
  ))

  const col2 = (s.breeding_complete ?? []).map((b: any) => (
    <Card key={b.id}>
      <p className="font-medium truncate">{b.mare.name} × {b.stallion.name}</p>
      <OwnerTag user={b.user} />
      <p className="text-xs text-stone-400">Completed {daysAgo(b.completedAt ?? b.createdAt)}</p>
      <p className="text-xs text-amber-600 font-medium">Awaiting foal record</p>
    </Card>
  ))

  const col3 = (s.foal_recorded ?? []).map((f: any) => (
    <Card key={f.id}>
      <p className="font-medium truncate">{f.name ?? <span className="italic text-stone-400">Unnamed</span>}</p>
      <p className="text-xs text-stone-500">{f.mare.name} × {f.stallion?.name ?? '—'}</p>
      <OwnerTag user={f.user} />
      {f.foaledAt && <p className="text-xs text-stone-400">Born {daysAgo(f.foaledAt)}</p>}
      <p className="text-xs text-amber-600 font-medium">Not yet listed</p>
    </Card>
  ))

  const col4 = (s.listing_in_progress ?? []).map((l: any) => (
    <Card key={l.id}>
      <p className="font-medium truncate">{l.horse?.name ?? 'Unknown'}</p>
      <OwnerTag user={l.seller} />
      <p className="text-xs text-stone-400">Listed {daysAgo(l.createdAt)}</p>
      <div className="pt-1">
        {l.missingDocTypes?.map((d: string) => (
          <span key={d} className="inline-block text-xs bg-red-50 text-red-600 rounded px-1.5 py-0.5 mr-1 mb-1">
            {d.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </Card>
  ))

  const col5 = (s.vetting_queue ?? []).map((l: any) => (
    <Card key={l.id}>
      <p className="font-medium truncate">{l.horse?.name ?? 'Unknown'}</p>
      <OwnerTag user={l.seller} />
      <p className="text-xs text-stone-400">In queue {daysAgo(l.createdAt)}</p>
      <Link
        to="/admin/vetting"
        className="text-xs text-brand-700 hover:underline font-medium"
      >
        Review →
      </Link>
    </Card>
  ))

  const col6 = (s.approved ?? []).map((l: any) => (
    <Card key={l.id}>
      <p className="font-medium truncate">{l.horse?.name ?? 'Unknown'}</p>
      <OwnerTag user={l.seller} />
      <p className="text-xs text-stone-400">Approved {daysAgo(l.vetApprovedAt ?? l.createdAt)}</p>
      <p className="text-xs text-amber-600 font-medium">Seller configuring auction</p>
    </Card>
  ))

  const col7 = (s.live ?? []).map((a: any) => (
    <Card key={a.id}>
      <p className="font-medium truncate">{a.listing?.horse?.name ?? 'Unknown'}</p>
      <OwnerTag user={a.listing?.seller} />
      <div className="flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          a.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {a.status === 'open' ? 'Live' : 'Scheduled'}
        </span>
        <Link to={`/auctions/${a.id}`} className="text-xs text-brand-700 hover:underline">
          View →
        </Link>
      </div>
    </Card>
  ))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Foal Pipeline</h1>
        <p className="text-xs text-stone-400">Refreshes every 30s</p>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          <StageColumn title="Breeding Confirmed" color="bg-yellow-400" items={col1} />
          <StageColumn title="Breeding Complete" color="bg-orange-400" items={col2} />
          <StageColumn title="Foal Recorded" color="bg-lime-500" items={col3} />
          <StageColumn title="Docs In Progress" color="bg-amber-400" items={col4} />
          <StageColumn title="Vetting Queue" color="bg-blue-400" items={col5} />
          <StageColumn title="Approved" color="bg-emerald-500" items={col6} />
          <StageColumn title="Live / Scheduled" color="bg-green-600" items={col7} />
        </div>
      </div>
    </div>
  )
}
