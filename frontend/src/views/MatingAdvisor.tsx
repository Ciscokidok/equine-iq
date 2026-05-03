import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { stallionDataQuality } from '@/lib/dataQuality'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getMare } from '@/api/mares'
import { getMares } from '@/api/mares'
import type { Horse } from '@/api/mares'
import client from '@/api/client'
import { analyzePairings, savePairing } from '@/api/pairings'
import type { PairingResult, RiskFlag } from '@/api/pairings'
import GeneticRiskPanel from '@/components/GeneticRiskPanel'

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
  return (
    <div className={`text-5xl font-bold ${color} leading-none`}>
      {pct}<span className="text-2xl">%</span>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: RiskFlag['severity'] }) {
  const map = { low: 'bg-blue-100 text-blue-700', medium: 'bg-yellow-100 text-yellow-700', high: 'bg-red-100 text-red-700' }
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${map[severity]}`}>{severity}</span>
}

const TIER_STYLE = {
  gold: 'bg-yellow-100 text-yellow-800',
  silver: 'bg-stone-100 text-stone-600',
  bronze: 'bg-orange-100 text-orange-700',
}

const TIER_LABEL = { gold: '🥇 Gold data', silver: '🥈 Silver data', bronze: '🥉 Bronze data' }

function AnalysisModal({ result, mare, goal, onClose, onSave }: {
  result: PairingResult
  mare: Horse
  goal: string
  onClose: () => void
  onSave: () => void
}) {
  const [showInfo, setShowInfo] = useState(false)
  const quality = stallionDataQuality(result.stallion as Horse)

  const dimensions = [
    { key: 'inbreeding_coefficient', label: 'Inbreeding' },
    { key: 'pedigree_outcrossing', label: 'Outcrossing' },
    { key: 'discipline_fit', label: 'Discipline Fit' },
    { key: 'conformation_complement', label: 'Conformation' },
    { key: 'performance_potential', label: 'Performance' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">{result.stallion.name}</h2>
            <p className="text-sm text-stone-400">{result.stallion.breed} · {result.stallion.studLocation ?? 'Location unknown'}</p>
          </div>
          <div className="text-right">
            <ScoreRing score={result.compatibility_score} />
            <p className="text-xs text-stone-400 mt-1">compatibility</p>
          </div>
        </div>

        {/* Data quality badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${TIER_STYLE[quality.tier]}`}>
            {TIER_LABEL[quality.tier]} ({quality.score}/{quality.max})
          </span>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="text-xs text-stone-400 hover:text-stone-700 underline"
          >
            {showInfo ? 'Hide' : 'How accurate is this analysis?'}
          </button>
        </div>

        {showInfo && (
          <div className="mb-5 bg-stone-50 border border-stone-200 rounded-lg p-4 text-xs text-stone-600 space-y-3">
            <div>
              <p className="font-semibold text-stone-800 mb-1">What this AI does well</p>
              <ul className="space-y-1 list-disc pl-4">
                <li>Discipline fit — identifying whether a stallion's specialty matches your breeding goal</li>
                <li>Flagging known genetic disease risks by breed (HYPP, WFFS, HERDA, etc.)</li>
                <li>Coherent reasoning using real equine terminology</li>
                <li>Quickly narrowing a large field down to candidates worth deeper research</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-stone-800 mb-1">Where professionals outperform it</p>
              <ul className="space-y-1 list-disc pl-4">
                <li><strong>Pedigree verification</strong> — it trusts whatever names you entered. Real consultants cross-check AQHA, KWPN, and USEF studbooks</li>
                <li><strong>EPD / breeding values</strong> — AQHA publishes Expected Progeny Differences; KWPN publishes breeding values. This AI doesn't have those unless you paste them into the stallion's EPD notes</li>
                <li><strong>Physical evaluation</strong> — conformation scoring without watching the horse move and assessing hoof angles, topline, and joint quality in person is inherently limited</li>
                <li><strong>Market knowledge</strong> — a consultant knows which bloodlines are trending at auctions and which are oversaturated</li>
                <li><strong>Inbreeding math</strong> — Wright's coefficient requires a fully verified multi-generation pedigree. This tool counts name occurrences as an approximation</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-stone-800 mb-1">Data quality: {quality.tier} ({quality.score}/{quality.max} points)</p>
              {quality.missing.length > 0 && (
                <p className="text-stone-500">
                  Add these to improve accuracy: {quality.missing.join(', ')}
                </p>
              )}
              <p className="mt-1 text-stone-400 italic">
                Treat this as a first-pass filter, then consult a professional for your top 2–3 candidates.
              </p>
            </div>
          </div>
        )}

        {/* Score breakdown */}
        <div className="mb-5">
          <p className="text-sm font-semibold mb-2">Score Breakdown</p>
          <div className="space-y-2">
            {dimensions.map(({ key, label }) => {
              const val = result.score_breakdown[key as keyof typeof result.score_breakdown] ?? 0
              const pct = Math.round(val * 100)
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-stone-500 mb-0.5">
                    <span>{label}</span><span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top strengths */}
        {result.top_strengths.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">Top Strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {result.top_strengths.map((s, i) => (
                <span key={i} className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning */}
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Analysis</p>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{result.reasoning}</p>
        </div>

        {/* Considerations */}
        {result.considerations.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">Things to Consider</p>
            <ul className="text-sm text-stone-600 space-y-1 list-disc pl-4">
              {result.considerations.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {/* Risk flags */}
        {result.risk_flags.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-semibold mb-2">Risk Flags</p>
            <div className="space-y-2">
              {result.risk_flags.map((flag, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <SeverityBadge severity={flag.severity} />
                  <p className="text-stone-600">{flag.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-stone-100">
          <button
            onClick={onSave}
            className="flex-1 bg-brand-700 text-white py-2 rounded text-sm hover:bg-brand-900"
          >
            Save this Pairing
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-stone-200 rounded text-sm hover:bg-stone-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function StallionCard({ stallion }: { stallion: Horse; selected: boolean; onToggle: () => void }) {
  return null // placeholder — rendered inline below
}

export default function MatingAdvisor() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data: mare } = useQuery({ queryKey: ['mare', id], queryFn: () => getMare(id!) })
  const { data: stallions = [] } = useQuery({
    queryKey: ['stallions'],
    queryFn: () => client.get<Horse[]>('/api/stallions').then(r => r.data),
  })

  const [goal, setGoal] = useState('')
  const [maxFee, setMaxFee] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<1 | 2>(1)
  const [activeResult, setActiveResult] = useState<PairingResult | null>(null)
  const [results, setResults] = useState<PairingResult[]>([])

  const analyzeMutation = useMutation({
    mutationFn: () => analyzePairings(id!, Array.from(selectedIds), goal),
    onSuccess: (data) => {
      setResults(data.results)
      setStep(2)
      if (data.errors.length) {
        const msg = (data.errors[0] as any)?.error ?? 'unknown error'
        toast.warning(`${data.errors.length} stallion(s) failed: ${msg}`)
      }
    },
    onError: () => toast.error('Analysis failed'),
  })

  const saveMutation = useMutation({
    mutationFn: (result: PairingResult) =>
      savePairing({
        mare_id: id!,
        stallion_id: result.stallion.id,
        compatibility_score: result.compatibility_score,
        score_breakdown: result.score_breakdown,
        reasoning: result.reasoning,
        risk_flags: result.risk_flags,
        top_strengths: result.top_strengths,
        considerations: result.considerations,
        goal,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pairings'] })
      toast.success('Pairing saved')
      setActiveResult(null)
    },
    onError: () => toast.error('Failed to save'),
  })

  const filteredStallions = stallions.filter((s) => {
    if (maxFee && s.studFee && s.studFee > parseInt(maxFee)) return false
    return true
  })

  const toggle = (stallionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(stallionId)) next.delete(stallionId)
      else if (next.size < 10) next.add(stallionId)
      else toast.warning('Max 10 stallions per analysis')
      return next
    })
  }

  const autoSelect = () => {
    if (!mare) return
    const byQuality = (a: Horse, b: Horse) =>
      stallionDataQuality(b as Horse).score - stallionDataQuality(a as Horse).score
    const eligible = filteredStallions.filter(s => s.offspringPerformanceSummary)
    const disciplineMatch = eligible.filter(s => s.discipline === mare.discipline).sort(byQuality)
    const other = eligible.filter(s => s.discipline !== mare.discipline).sort(byQuality)
    const sorted = [...disciplineMatch, ...other].slice(0, 10)
    setSelectedIds(new Set(sorted.map(s => s.id)))
    toast.success(`Auto-selected ${sorted.length} stallion${sorted.length !== 1 ? 's' : ''} (${disciplineMatch.length} discipline match${disciplineMatch.length !== 1 ? 'es' : ''})`)
  }

  if (!mare) return <p className="text-sm text-stone-400">Loading…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Mating Advisor</h1>
        <p className="text-sm text-stone-400">Mare: {mare.name} · {mare.discipline.replace(/_/g, ' ')}</p>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1">What are you breeding this foal for? *</label>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="input w-full max-w-lg"
              placeholder="e.g. 1.40m show jumping, reining futurity, sport horse auction prospect"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Max stud fee (optional)</label>
            <input
              type="number"
              value={maxFee}
              onChange={(e) => setMaxFee(e.target.value)}
              className="input w-40"
              placeholder="e.g. 3000"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">
                Select stallions to analyze ({selectedIds.size}/10)
                <span className="text-xs text-stone-400 font-normal ml-2">— {filteredStallions.filter(s => s.discipline === mare.discipline).length} discipline matches, {filteredStallions.length} total</span>
              </p>
              <button
                type="button"
                onClick={autoSelect}
                disabled={filteredStallions.filter(s => s.offspringPerformanceSummary).length === 0}
                className="text-xs px-3 py-1.5 rounded border border-brand-700 text-brand-700 hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Auto-select best matches
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStallions.map((stallion) => {
                const sel = selectedIds.has(stallion.id)
                const noData = !stallion.offspringPerformanceSummary
                const disciplineMismatch = stallion.discipline !== mare.discipline
                return (
                  <button
                    key={stallion.id}
                    onClick={() => !noData && toggle(stallion.id)}
                    disabled={noData}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      sel
                        ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700'
                        : noData
                        ? 'border-stone-100 bg-stone-50 opacity-50 cursor-not-allowed'
                        : 'border-stone-200 hover:border-brand-500 bg-white'
                    }`}
                  >
                    <p className="font-medium text-sm">{stallion.name}</p>
                    <p className="text-xs text-stone-400">{stallion.breed}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {stallion.studFee ? (
                        <span className="text-xs text-stone-500">${stallion.studFee.toLocaleString()}</span>
                      ) : (
                        <span className="text-xs text-stone-300">fee n/a</span>
                      )}
                      {disciplineMismatch && <span className="text-xs text-amber-600 italic">cross-discipline</span>}
                      {noData && <span className="text-xs text-stone-300 italic">insufficient data</span>}
                    </div>
                  </button>
                )
              })}
              {filteredStallions.length === 0 && (
                <p className="col-span-3 text-sm text-stone-400 py-4">No stallions in catalog yet. Import some via Claude Desktop or the Stallion Catalog.</p>
              )}
            </div>
          </div>

          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={selectedIds.size === 0 || !goal.trim() || analyzeMutation.isPending}
            className="bg-brand-700 text-white px-5 py-2.5 rounded text-sm font-medium hover:bg-brand-900 disabled:opacity-40 transition-colors"
          >
            {analyzeMutation.isPending
              ? `Analyzing ${selectedIds.size} stallion${selectedIds.size > 1 ? 's' : ''}…`
              : `Analyze ${selectedIds.size} Selected`}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{results.length} results — sorted by compatibility</h2>
            <button onClick={() => setStep(1)} className="text-sm text-brand-700 hover:underline">← Change selection</button>
          </div>

          {results.map((result, i) => {
            const pct = Math.round(result.compatibility_score * 100)
            const scoreColor = pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'
            const highFlags = result.risk_flags.filter((f) => f.severity === 'high')

            return (
              <div key={result.stallion.id} className="bg-white border border-stone-200 rounded-lg p-4 flex gap-4">
                <div className="text-center min-w-[64px]">
                  <p className={`text-4xl font-bold leading-none ${scoreColor}`}>{pct}<span className="text-lg">%</span></p>
                  <p className="text-xs text-stone-400 mt-1">#{i + 1}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{result.stallion.name}</p>
                      <p className="text-xs text-stone-400">
                        {result.stallion.breed}
                        {result.stallion.studFee ? ` · $${result.stallion.studFee.toLocaleString()}` : ''}
                        {result.stallion.studLocation ? ` · ${result.stallion.studLocation}` : ''}
                      </p>
                    </div>
                    {highFlags.length > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                        {highFlags.length} high risk
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.top_strengths.map((s, j) => (
                      <span key={j} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                  <GeneticRiskPanel
                    mareBreed={mare.breed}
                    stallionBreed={result.stallion.breed}
                    discipline={mare.discipline}
                    compact
                  />
                  <button
                    onClick={() => setActiveResult(result)}
                    className="mt-3 text-xs text-brand-700 hover:underline"
                  >
                    View Full Analysis →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeResult && (
        <AnalysisModal
          result={activeResult}
          mare={mare}
          goal={goal}
          onClose={() => setActiveResult(null)}
          onSave={() => saveMutation.mutate(activeResult)}
        />
      )}
    </div>
  )
}
