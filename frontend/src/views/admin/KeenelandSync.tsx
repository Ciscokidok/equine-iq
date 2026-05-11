import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getKeenelandStatus, keenelandDryRun, keenelandSync, keenelandCleanup,
  type KeenelandSaleDetail, type KeenelandDryRunResult, type KeenelandSyncStarted,
} from '@/api/keeneland'

function getTokenRole(): string | null {
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return null
    return JSON.parse(atob(token.split('.')[1]))?.role ?? null
  } catch { return null }
}

function saleName(sourceFileName: string): string {
  return sourceFileName.replace('keeneland_', '')
}

function fmt(n: number): string {
  return n.toLocaleString()
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'completed' ? 'bg-emerald-500' :
    status === 'processing' ? 'bg-amber-400 animate-pulse' :
    'bg-red-400'
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
}

function DetailRow({ d }: { d: KeenelandSaleDetail }) {
  const icon = d.status === 'imported' ? '✓' : d.status === 'error' ? '✗' : '—'
  const color = d.status === 'imported' ? 'text-emerald-600' : d.status === 'error' ? 'text-red-500' : 'text-stone-400'
  return (
    <tr className="border-t border-stone-100 text-sm">
      <td className="py-1.5 pr-3 font-mono text-xs text-stone-500">{d.sale_id}</td>
      <td className="py-1.5 pr-3">{d.name}</td>
      <td className="py-1.5 pr-3 text-stone-500">{d.date ?? '—'}</td>
      <td className={`py-1.5 pr-3 font-medium ${color}`}>{icon} {d.status}</td>
      {d.status === 'imported' ? (
        <>
          <td className="py-1.5 pr-3 text-right text-stone-600">{fmt(d.created ?? 0)}</td>
          <td className="py-1.5 pr-3 text-right text-stone-600">{fmt(d.matched ?? 0)}</td>
          <td className="py-1.5 text-right text-stone-400">{fmt(d.errors ?? 0)}</td>
        </>
      ) : (
        <td colSpan={3} className="py-1.5 text-stone-400 text-xs italic">{d.reason ?? ''}</td>
      )}
    </tr>
  )
}

export default function KeenelandSync() {
  const role = getTokenRole()
  if (role !== 'admin') return <p className="p-8 text-stone-500">Access denied</p>
  return <KeenelandSyncInner />
}

function KeenelandSyncInner() {
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()
  const [sinceYear, setSinceYear] = useState(currentYear - 2)
  const [preview, setPreview] = useState<KeenelandDryRunResult | null>(null)
  const [syncInfo, setSyncInfo] = useState<KeenelandSyncStarted | null>(null)
  const [polling, setPolling] = useState(false)
  const prevCountRef = useRef(0)

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ['keeneland-status'],
    queryFn: getKeenelandStatus,
    refetchInterval: (query) => {
      if (polling) return 4000
      const batches = (query.state.data as typeof status)?.batches ?? []
      if (batches.some((b) => b.status === 'processing')) return 8000
      return false
    },
  })

  // Stop polling once we've seen all expected batches land as completed
  useEffect(() => {
    if (!polling || !syncInfo || !status) return
    const completed = status.batches.filter((b) => b.status === 'completed').length
    const processing = status.batches.filter((b) => b.status === 'processing').length
    const newCount = status.batches.length

    if (newCount > prevCountRef.current) prevCountRef.current = newCount

    // Done when no processing batches and count stopped growing
    if (processing === 0 && completed >= (syncInfo.alreadyImported + syncInfo.toImport - (syncInfo.alreadyImported))) {
      setPolling(false)
      qc.invalidateQueries({ queryKey: ['keeneland-status'] })
    }
  }, [status, polling, syncInfo, qc])

  const importedSoFar = status
    ? status.batches.filter((b) => b.status === 'completed').length
    : 0
  const processingSoFar = status
    ? status.batches.filter((b) => b.status === 'processing').length
    : 0

  const progress = syncInfo
    ? Math.min(100, Math.round((importedSoFar / (syncInfo.alreadyImported + syncInfo.toImport)) * 100))
    : 0

  const cleanup = useMutation({
    mutationFn: keenelandCleanup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keeneland-status'] }),
  })

  const dryRun = useMutation({
    mutationFn: () => keenelandDryRun(sinceYear),
    onSuccess: (data) => { setPreview(data); setSyncInfo(null) },
  })

  const sync = useMutation({
    mutationFn: () => keenelandSync(sinceYear),
    onSuccess: (data) => {
      setPreview(null)
      if ('started' in data && data.started) {
        setSyncInfo(data as KeenelandSyncStarted)
        prevCountRef.current = status?.batches.length ?? 0
        setPolling(true)
        refetchStatus()
      } else {
        qc.invalidateQueries({ queryKey: ['keeneland-status'] })
      }
    },
  })

  const busy = dryRun.isPending || sync.isPending || polling || cleanup.isPending
  const hasStuck = status?.batches.some((b) => b.status === 'processing') ?? false

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Keeneland Sale Sync</h1>
        <p className="text-sm text-stone-500 mt-1">
          Downloads sale results from flex.keeneland.com and imports them into the shared horse catalog.
          Already-imported sales are skipped automatically.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">Run Sync</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Import sales from year</label>
            <input
              type="number"
              value={sinceYear}
              min={2000}
              max={currentYear}
              onChange={(e) => setSinceYear(parseInt(e.target.value) || currentYear - 2)}
              className="w-28 border border-stone-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={() => dryRun.mutate()}
            disabled={busy}
            className="px-4 py-1.5 rounded border border-stone-300 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            {dryRun.isPending ? 'Checking…' : 'Preview'}
          </button>
          <button
            onClick={() => sync.mutate()}
            disabled={busy}
            className="px-4 py-1.5 rounded bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-40"
          >
            {sync.isPending ? 'Starting…' : polling ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        {/* Progress bar */}
        {polling && syncInfo && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between text-xs text-stone-500">
              <span>Importing {syncInfo.toImport} sales in background…</span>
              <span>{importedSoFar} / {syncInfo.alreadyImported + syncInfo.toImport} completed{processingSoFar > 0 ? ` · ${processingSoFar} processing` : ''}</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-brand-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {(dryRun.isError || sync.isError) && (
          <p className="text-sm text-red-600">
            {((dryRun.error || sync.error) as Error)?.message ?? 'Request failed'}
          </p>
        )}
      </div>

      {/* Dry-run preview */}
      {preview && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">Preview</h2>
            <span className="text-xs text-stone-400">dry run — nothing imported</span>
          </div>
          <div className="flex gap-6 text-sm flex-wrap">
            <div><span className="text-stone-500">Eligible:</span> <strong>{preview.eligible}</strong></div>
            <div><span className="text-stone-500">Already imported:</span> <strong>{preview.alreadyImported}</strong></div>
            <div><span className="text-stone-500">Will import:</span> <strong className="text-brand-700">{preview.toImport}</strong></div>
          </div>
          {preview.sales.length > 0 && (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-stone-400 uppercase tracking-wide">
                    <th className="pb-2 pr-3">Sale ID</th>
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sales.map((s) => (
                    <tr key={s.sale_id} className="border-t border-stone-100 text-sm">
                      <td className="py-1.5 pr-3 font-mono text-xs text-stone-500">{s.sale_id}</td>
                      <td className="py-1.5 pr-3">{s.name}</td>
                      <td className="py-1.5 text-stone-500">{s.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.toImport === 0 && (
            <p className="text-sm text-stone-400 italic">All eligible sales are already imported.</p>
          )}
        </div>
      )}

      {/* Import history */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">
            Import History
            {status && <span className="ml-2 text-stone-400 font-normal">({status.count} sales)</span>}
            {polling && <span className="ml-2 text-amber-500 text-xs font-normal animate-pulse">● live</span>}
          </h2>
          {hasStuck && !polling && (
            <button
              onClick={() => cleanup.mutate()}
              disabled={busy}
              className="text-xs px-3 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
            >
              {cleanup.isPending ? 'Clearing…' : 'Clear stuck & retry'}
            </button>
          )}
        </div>
        {statusLoading && <p className="text-sm text-stone-400">Loading…</p>}
        {status && status.batches.length === 0 && (
          <p className="text-sm text-stone-400 italic">No Keeneland sales imported yet.</p>
        )}
        {status && status.batches.length > 0 && (
          <div className="overflow-auto max-h-80">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-stone-400 uppercase tracking-wide">
                  <th className="pb-2 pr-3">Sale ID</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3 text-right">Rows</th>
                  <th className="pb-2 pr-3 text-right">Created</th>
                  <th className="pb-2 pr-3 text-right">Matched</th>
                  <th className="pb-2">Imported</th>
                </tr>
              </thead>
              <tbody>
                {status.batches.map((b) => (
                  <tr key={b.id} className="border-t border-stone-100 text-sm">
                    <td className="py-1.5 pr-3 font-mono text-xs text-stone-500">{saleName(b.sourceFileName)}</td>
                    <td className="py-1.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={b.status} />
                        {b.status}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right text-stone-600">{fmt(b.totalRows)}</td>
                    <td className="py-1.5 pr-3 text-right text-stone-600">{fmt(b.createdCount)}</td>
                    <td className="py-1.5 pr-3 text-right text-stone-600">{fmt(b.matchedCount)}</td>
                    <td className="py-1.5 text-stone-400 text-xs">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
