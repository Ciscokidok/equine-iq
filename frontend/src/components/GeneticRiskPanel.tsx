interface Disease {
  name: string
  fullName: string
  breeds: string[]
  risk: 'high' | 'medium'
  description: string
  action: string
}

const GENETIC_DISEASES: Disease[] = [
  {
    name: 'HYPP',
    fullName: 'Hyperkalemic Periodic Paralysis',
    breeds: ['quarter_horse', 'paint', 'appaloosa'],
    risk: 'high',
    description: 'Muscle weakness/paralysis episodes. Traces to Impressive bloodlines. N/H1 horses are affected; H1/H1 is often lethal.',
    action: 'Request HYPP genetic test before breeding.',
  },
  {
    name: 'HERDA',
    fullName: 'Hereditary Equine Regional Dermal Asthenia',
    breeds: ['quarter_horse'],
    risk: 'high',
    description: 'Skin separates from underlying tissue. Prevalent in cutting horse lines (Doc Bar descendants). Lethal in severe cases.',
    action: 'Request HERDA test — especially critical for cutting bloodlines.',
  },
  {
    name: 'GBED',
    fullName: 'Glycogen Branching Enzyme Deficiency',
    breeds: ['quarter_horse', 'paint'],
    risk: 'high',
    description: 'Foals are stillborn or die within weeks. Carrier × carrier breeding = 25% chance of affected foal.',
    action: 'Both parents should be GBED tested before breeding.',
  },
  {
    name: 'OLWS',
    fullName: 'Overo Lethal White Syndrome',
    breeds: ['paint'],
    risk: 'high',
    description: 'Frame Overo × Frame Overo crosses produce 25% all-white foals that die within days of colic.',
    action: 'Avoid Frame Overo × Frame Overo pairings. Test both parents for OLWS gene.',
  },
  {
    name: 'WFFS',
    fullName: 'Warmblood Fragile Foal Syndrome',
    breeds: ['warmblood', 'sport_horse'],
    risk: 'high',
    description: 'Foals are born with fragile, hyperextensible skin and joints. Carrier rate ~10% in Warmbloods.',
    action: 'Request WFFS genetic test for both sire and dam.',
  },
  {
    name: 'PSSM',
    fullName: 'Polysaccharide Storage Myopathy',
    breeds: ['warmblood', 'sport_horse', 'quarter_horse', 'paint', 'other'],
    risk: 'medium',
    description: 'Muscle tying-up, weakness, and poor performance. Manageable with diet but heritable.',
    action: 'Consider PSSM genetic test — especially if either parent has tying-up history.',
  },
  {
    name: 'MH',
    fullName: 'Malignant Hyperthermia',
    breeds: ['quarter_horse', 'paint'],
    risk: 'medium',
    description: 'Life-threatening reaction to certain anesthetics. Often co-occurs with PSSM.',
    action: 'MH test recommended for horses undergoing surgery.',
  },
]

function matchesBreed(breedStr: string, discipline: string, diseaseBreeds: string[]): boolean {
  if (diseaseBreeds.includes(discipline)) return true
  const lower = breedStr.toLowerCase()
  if (diseaseBreeds.includes('quarter_horse') && (lower.includes('quarter') || lower.includes('aqha'))) return true
  if (diseaseBreeds.includes('paint') && (lower.includes('paint') || lower.includes('apha'))) return true
  if (diseaseBreeds.includes('warmblood') && (
    lower.includes('warmblood') || lower.includes('kwpn') || lower.includes('hanoverian') ||
    lower.includes('oldenburg') || lower.includes('holsteiner') || lower.includes('trakehner') || lower.includes('westphalian')
  )) return true
  if (diseaseBreeds.includes('sport_horse') && lower.includes('sport')) return true
  if (diseaseBreeds.includes('appaloosa') && lower.includes('appaloosa')) return true
  return false
}

interface Props {
  mareBreed: string
  stallionBreed: string
  discipline: string
  compact?: boolean
}

export default function GeneticRiskPanel({ mareBreed, stallionBreed, discipline, compact = false }: Props) {
  const relevant = GENETIC_DISEASES.filter(
    (d) =>
      matchesBreed(mareBreed, discipline, d.breeds) ||
      (stallionBreed && matchesBreed(stallionBreed, discipline, d.breeds)),
  )

  if (relevant.length === 0) return null

  const highCount = relevant.filter((d) => d.risk === 'high').length

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-700 mt-1">
        <span>⚠️</span>
        <span>{relevant.length} genetic risk{relevant.length > 1 ? 's' : ''} flagged for this breed combination</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span>⚠️</span>
        <h2 className="text-sm font-semibold">Genetic Risk Flags</h2>
        {highCount > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
            {highCount} high risk
          </span>
        )}
      </div>
      <div className="space-y-3">
        {relevant.map((d) => (
          <div key={d.name} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold">{d.name}</span>
              <span className="text-xs text-stone-400">{d.fullName}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ml-auto ${
                  d.risk === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {d.risk}
              </span>
            </div>
            <p className="text-xs text-stone-600 mb-1">{d.description}</p>
            <p className="text-xs text-stone-400 italic">{d.action}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
