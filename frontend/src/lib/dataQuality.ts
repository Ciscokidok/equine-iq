import type { Horse } from '@/api/mares'

export type QualityTier = 'bronze' | 'silver' | 'gold'

export interface DataQuality {
  score: number
  max: number
  tier: QualityTier
  missing: string[]
}

export function stallionDataQuality(s: Horse): DataQuality {
  const checks: Array<{ label: string; points: number; pass: boolean }> = [
    { label: 'Sire & dam recorded', points: 2, pass: !!(s.pedigree?.sire && s.pedigree?.dam) },
    { label: '3-generation pedigree', points: 2, pass: !!(s.pedigree?.sire_sire || s.pedigree?.dam_sire) },
    { label: 'Offspring performance summary', points: 2, pass: !!s.offspringPerformanceSummary },
    { label: 'Offspring count', points: 1, pass: s.offspringCount > 0 },
    { label: 'Conformation notes', points: 1, pass: !!s.conformationNotes },
    { label: 'Registry number', points: 1, pass: !!s.registrationNumber },
    { label: 'EPD / breeding values', points: 1, pass: !!s.epdNotes },
  ]

  const score = checks.filter((c) => c.pass).reduce((sum, c) => sum + c.points, 0)
  const max = checks.reduce((sum, c) => sum + c.points, 0)
  const missing = checks.filter((c) => !c.pass).map((c) => c.label)
  const tier: QualityTier = score >= 8 ? 'gold' : score >= 4 ? 'silver' : 'bronze'

  return { score, max, tier, missing }
}
