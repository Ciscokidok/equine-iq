import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPairings, deletePairing } from '@/api/pairings'
import type { SavedPairing, ScoreBreakdown } from '@/api/pairings'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const COMPARE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b']

const SCORE_DIMS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'inbreeding_coefficient', label: 'Inbreeding' },
  { key: 'pedigree_outcrossing', label: 'Outcrossing' },
  { key: 'discipline_fit', label: 'Discipline' },
  { key: 'conformation_complement', label: 'Conformation' },
  { key: 'performance_potential', label: 'Performance' },
]

const DIM_LABELS: Record<string, string> = {
  inbreeding_coefficient: 'Inbreeding Coefficient',
  pedigree_outcrossing: 'Pedigree Outcrossing',
  discipline_fit: 'Discipline Fit',
  conformation_complement: 'Conformation Complement',
  performance_potential: 'Performance Potential',
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 75 ? 'bg-green-100 text-green-800' : pct >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
  return <span className={`text-sm font-bold px-2 py-0.5 rounded ${color}`}>{pct}%</span>
}

function ComparePanel({ pairings, onClose }: { pairings: SavedPairing[]; onClose: () => void }) {
  const chartData = SCORE_DIMS.map(({ key, label }) => {
    const row: Record<string, number | string> = { dim: label }
    pairings.forEach((p) => {
      row[p.stallion.name] = Math.round((p.scoreBreakdown[key] ?? 0) * 100)
    })
    return row
  })

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Side-by-Side Comparison</h2>
        <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-700">
          ✕ Clear comparison
        </button>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis dataKey="dim" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
          <Tooltip formatter={(v: number) => `${v}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {pairings.map((p, i) => (
            <Bar key={p.id} dataKey={p.stallion.name} fill={COMPARE_COLORS[i % COMPARE_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function PrintArea({ pairing }: { pairing: SavedPairing }) {
  return (
    <div
      id="print-area"
      style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 9999,
        background: '#fff',
        padding: '40px',
        fontFamily: 'Georgia, serif',
        color: '#1c1917',
        boxSizing: 'border-box',
      }}
    >
      <style dangerouslySetInnerHTML={{
        __html: `@media print {
          body > * { display: none !important; }
          #print-area { display: block !important; position: static !important; }
        }`,
      }} />

      <div style={{ borderBottom: '2px solid #1c1917', paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 'bold' }}>EquineIQ Mating Report</h1>
        <p style={{ margin: '4px 0 0', color: '#78716c', fontSize: 13 }}>
          Generated {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}
        </p>
      </div>

      <h2 style={{ fontSize: 20, margin: '0 0 4px' }}>
        {pairing.mare.name} × {pairing.stallion.name}
      </h2>
      <p style={{ color: '#78716c', margin: '0 0 20px', fontSize: 14 }}>
        Goal: {pairing.goal}
      </p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 36, fontWeight: 'bold', color: '#166534' }}>
          {Math.round(pairing.compatibilityScore * 100)}%
        </span>
        <span style={{ color: '#78716c', fontSize: 14 }}>Compatibility Score</span>
      </div>

      <h3 style={{ fontSize: 15, margin: '0 0 8px', borderBottom: '1px solid #e7e5e4', paddingBottom: 4 }}>
        Score Breakdown
      </h3>
      <table style={{ width: '100%', fontSize: 13, marginBottom: 20, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#fafaf9' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 'normal', color: '#78716c' }}>Dimension</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 'normal', color: '#78716c' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(pairing.scoreBreakdown).map(([key, val]) => (
            <tr key={key} style={{ borderTop: '1px solid #f5f5f4' }}>
              <td style={{ padding: '4px 8px' }}>{DIM_LABELS[key] ?? key}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                {Math.round((val as number) * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 15, margin: '0 0 8px', borderBottom: '1px solid #e7e5e4', paddingBottom: 4 }}>
        Analysis
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{pairing.reasoning}</p>

      {(pairing.topStrengths as string[]).length > 0 && (
        <>
          <h3 style={{ fontSize: 15, margin: '0 0 8px', borderBottom: '1px solid #e7e5e4', paddingBottom: 4 }}>
            Top Strengths
          </h3>
          <ul style={{ fontSize: 13, paddingLeft: 20, marginBottom: 20 }}>
            {(pairing.topStrengths as string[]).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}

      {(pairing.considerations as string[]).length > 0 && (
        <>
          <h3 style={{ fontSize: 15, margin: '0 0 8px', borderBottom: '1px solid #e7e5e4', paddingBottom: 4 }}>
            Considerations
          </h3>
          <ul style={{ fontSize: 13, paddingLeft: 20, marginBottom: 20 }}>
            {(pairing.considerations as string[]).map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </>
      )}

      {(pairing.riskFlags as Array<{ flag_type: string; description: string; severity: string }>).length > 0 && (
        <>
          <h3 style={{ fontSize: 15, margin: '0 0 8px', borderBottom: '1px solid #e7e5e4', paddingBottom: 4 }}>
            Risk Flags
          </h3>
          {(pairing.riskFlags as Array<{ flag_type: string; description: string; severity: string }>).map((r, i) => (
            <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
              <strong>[{r.severity.toUpperCase()}]</strong> {r.flag_type}: {r.description}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function Pairings() {
  const qc = useQueryClient()
  const { data: pairings = [], isLoading } = useQuery({ queryKey: ['pairings'], queryFn: getPairings })
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [printPairing, setPrintPairing] = useState<SavedPairing | null>(null)
  const [showCompare, setShowCompare] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deletePairing,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pairings'] }); toast.success('Deleted') },
    onError: () => toast.error('Delete failed'),
  })

  useEffect(() => {
    if (!printPairing) return
    const prev = document.getElementById('print-area')
    if (prev) prev.style.display = 'block'
    window.print()
    if (prev) prev.style.display = 'none'
  }, [printPairing])

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    )
  }

  const comparePairings = pairings.filter((p) => compareIds.includes(p.id))

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Saved Pairings</h1>
        {compareIds.length >= 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="bg-brand-700 text-white px-3 py-1.5 rounded text-sm hover:bg-brand-900"
          >
            Compare {compareIds.length} Selected
          </button>
        )}
      </div>

      {showCompare && comparePairings.length >= 2 && (
        <ComparePanel pairings={comparePairings} onClose={() => { setShowCompare(false); setCompareIds([]) }} />
      )}

      {pairings.length === 0 && (
        <p className="text-stone-400 text-sm">No saved pairings yet. Run the mating advisor on a mare to get started.</p>
      )}

      <div className="space-y-3">
        {pairings.map((p) => (
          <div key={p.id} className="bg-white border border-stone-200 rounded-lg p-4 flex items-start gap-4">
            <div className="flex flex-col items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                checked={compareIds.includes(p.id)}
                onChange={() => toggleCompare(p.id)}
                disabled={!compareIds.includes(p.id) && compareIds.length >= 3}
                className="w-4 h-4 cursor-pointer"
                title="Select to compare"
              />
              <ScoreBadge score={p.compatibilityScore} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{p.mare.name} × {p.stallion.name}</p>
              <p className="text-xs text-stone-400 truncate">{p.goal}</p>
              <p className="text-xs text-stone-300 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <button
                onClick={() => setPrintPairing(p)}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
              >
                Print Report
              </button>
              <button
                onClick={() => deleteMutation.mutate(p.id)}
                disabled={deleteMutation.isPending}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {printPairing && <PrintArea pairing={printPairing} />}
    </div>
  )
}
