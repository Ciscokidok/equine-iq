import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getHistory, getBatch, type ImportBatch, type ExecuteSummary } from '@/api/import'

export default function ImportHistory() {
  const { id } = useParams<{ id?: string }>()
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [detail, setDetail] = useState<ExecuteSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      getBatch(id).then(setDetail).finally(() => setLoading(false))
    } else {
      getHistory().then((r) => setBatches(r.batches)).finally(() => setLoading(false))
    }
  }, [id])

  if (loading) return <p className="text-stone-400 p-8">Loading…</p>

  if (id && detail) {
    return (
      <div className="max-w-3xl mx-auto mt-8 px-4">
        <div className="mb-4">
          <Link to="/import/history" className="text-stone-400 text-sm hover:text-white">← Back to history</Link>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Import Detail</h1>
        <div className="p-4 bg-stone-800 rounded-xl mb-4 text-sm text-stone-300 space-y-1">
          <p>Source: <span className="text-white">{detail.source}</span></p>
          {detail.sourceFileName && <p>File: <span className="text-white">{detail.sourceFileName}</span></p>}
          <p>Date: <span className="text-white">{new Date(detail.createdAt).toLocaleString()}</span></p>
          <p>Status: <span className={detail.status === 'completed' ? 'text-green-400' : 'text-red-400'}>{detail.status}</span></p>
        </div>
        <div className="flex gap-6 mb-4 text-sm">
          <span className="text-green-400">{detail.createdCount} created</span>
          <span className="text-yellow-400">{detail.matchedCount} matched</span>
          <span className="text-red-400">{detail.errorCount} errors</span>
        </div>
        {detail.errorLog.length > 0 && (
          <div>
            <h2 className="text-stone-300 font-medium mb-2">Row errors</h2>
            <div className="space-y-1">
              {detail.errorLog.map((e, i) => (
                <div key={i} className="text-xs p-2 bg-red-900/30 rounded text-red-300">
                  Row {e.rowIndex + 1}: {e.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!id) {
    if (batches.length === 0) {
      return (
        <div className="max-w-xl mx-auto mt-16 text-center">
          <p className="text-stone-400 mb-4">No imports yet — upload a CSV or connect a data source to get started.</p>
          <Link to="/import" className="px-4 py-2 bg-brand-700 text-white rounded-lg text-sm">Start Import</Link>
        </div>
      )
    }
    return (
      <div className="max-w-3xl mx-auto mt-8 px-4">
        <h1 className="text-2xl font-bold text-white mb-6">Import History</h1>
        <div className="space-y-2">
          {batches.map((b) => (
            <Link key={b.id} to={`/import/history/${b.id}`} className="block p-4 bg-stone-800 rounded-xl hover:bg-stone-700 transition">
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  <span className="text-white font-medium capitalize">{b.source}</span>
                  {b.sourceFileName && <span className="text-stone-400 ml-2">{b.sourceFileName}</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'completed' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{b.status}</span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-stone-400">
                <span>{b.createdCount} created</span>
                <span>{b.matchedCount} matched</span>
                <span>{b.errorCount} errors</span>
                <span>{new Date(b.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return <p className="text-stone-400 p-8">Not found.</p>
}
