import client from './client'
import type { Horse } from './mares'

export interface ScoreBreakdown {
  inbreeding_coefficient: number
  pedigree_outcrossing: number
  discipline_fit: number
  conformation_complement: number
  performance_potential: number
}

export interface RiskFlag {
  flag_type: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface PairingResult {
  stallion: Horse
  compatibility_score: number
  score_breakdown: ScoreBreakdown
  reasoning: string
  risk_flags: RiskFlag[]
  top_strengths: string[]
  considerations: string[]
}

export interface SavedPairing {
  id: string
  mareId: string
  stallionId: string
  compatibilityScore: number
  scoreBreakdown: ScoreBreakdown
  reasoning: string
  riskFlags: RiskFlag[]
  topStrengths: string[]
  considerations: string[]
  goal: string
  notes?: string
  saved: boolean
  createdAt: string
  mare: Pick<Horse, 'name' | 'breed' | 'discipline'>
  stallion: Pick<Horse, 'name' | 'breed' | 'studFee' | 'studLocation'>
}

export const analyzePairings = (mareId: string, stallionIds: string[], goal: string) =>
  client.post<{ results: PairingResult[]; errors: any[] }>('/api/pairings/analyze', {
    mare_id: mareId,
    stallion_ids: stallionIds,
    goal,
  }).then(r => r.data)

export const savePairing = (data: {
  mare_id: string
  stallion_id: string
  compatibility_score: number
  score_breakdown: ScoreBreakdown
  reasoning: string
  risk_flags: RiskFlag[]
  top_strengths: string[]
  considerations: string[]
  goal: string
  notes?: string
}) => client.post<SavedPairing>('/api/pairings', data).then(r => r.data)

export const getPairings = () => client.get<SavedPairing[]>('/api/pairings').then(r => r.data)
export const deletePairing = (id: string) => client.delete(`/api/pairings/${id}`).then(r => r.data)
