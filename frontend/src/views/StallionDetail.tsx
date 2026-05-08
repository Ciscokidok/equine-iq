import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getStallion } from '@/api/stallions'
import GeneticRiskPanel from '@/components/GeneticRiskPanel'
import { stallionDataQuality } from '@/lib/dataQuality'
import { useStallionSaleStats } from '@/api/auctionSales'

export default function StallionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: stallion, isLoading, isError } = useQuery({
    queryKey: ['stallion', id],
    queryFn: () => getStallion(id!),
  })

  const { data: saleStats } = useStallionSaleStats(id ?? '')

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>
  if (isError || !stallion) return <p className="text-sm text-red-500">Stallion not found.</p>

  const pedigree = stallion.pedigree as Record<string, any>
  const quality = stallionDataQuality(stallion)
  const registryLinks = [
    { label: 'AQHA', url: `https://www.aqha.com/horse-search?q=${encodeURIComponent(stallion.name)}`, disciplines: ['quarter_horse', 'paint', 'reining', 'cutting', 'barrel_racing'] },
    { label: 'KWPN', url: `https://www.kwpn.nl/paard/search?q=${encodeURIComponent(stallion.name)}`, disciplines: ['warmblood', 'sport_horse', 'dressage', 'hunter_jumper', 'eventing'] },
    { label: 'NRHA', url: `https://www.nrha.com/index.php?option=com_horses&task=search&q=${encodeURIComponent(stallion.name)}`, disciplines: ['reining'] },
    { label: 'USEF', url: `https://www.usef.org/search#q=${encodeURIComponent(stallion.name)}&t=Horse`, disciplines: ['dressage', 'hunter_jumper', 'eventing', 'sport_horse'] },
  ].filter((r) => r.disciplines.includes(stallion.discipline))

  const inquiryBody = encodeURIComponent(
    `Hello,\n\nI am interested in breeding services for ${stallion.name}.\n\nPlease provide availability and pricing information.\n\nThank you.`,
  )
  const inquirySubject = encodeURIComponent(`Breeding Inquiry: ${stallion.name}`)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold">{stallion.name}</h1>
            <p className="text-stone-500">
              {stallion.breed} · {stallion.discipline.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <Link
          to={`/horses/${id}/pedigree`}
          className="border border-stone-200 px-3 py-1.5 rounded text-sm hover:bg-stone-50"
        >
          Pedigree Tree
        </Link>
      </div>

      {/* Contact actions */}
      {(stallion.studBookingUrl || stallion.studLocation) && (
        <div className="flex flex-wrap gap-3">
          {stallion.studBookingUrl && (
            <a
              href={stallion.studBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-brand-900"
            >
              Book This Stallion →
            </a>
          )}
          {stallion.studLocation && (
            <a
              href={`mailto:?subject=${inquirySubject}&body=${inquiryBody}`}
              className="border border-stone-200 px-4 py-2 rounded text-sm hover:bg-stone-50"
            >
              Send Inquiry Email
            </a>
          )}
        </div>
      )}

      {/* Data quality + registry links */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${quality.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' : quality.tier === 'silver' ? 'bg-stone-100 text-stone-600' : 'bg-orange-100 text-orange-700'}`}>
          {quality.tier === 'gold' ? '🥇' : quality.tier === 'silver' ? '🥈' : '🥉'} {quality.tier} data ({quality.score}/{quality.max})
        </span>
        {registryLinks.map((r) => (
          <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
            className="text-xs border border-stone-200 px-2 py-0.5 rounded hover:bg-stone-50 text-stone-600">
            Look up on {r.label} →
          </a>
        ))}
      </div>

      {/* Details */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 grid sm:grid-cols-2 gap-3 text-sm">
        {stallion.studFee != null && (
          <div>
            <span className="text-stone-400">Stud Fee:</span>{' '}
            <span className="font-medium">${stallion.studFee.toLocaleString()}</span>
          </div>
        )}
        {stallion.studLocation && (
          <div>
            <span className="text-stone-400">Location:</span>{' '}
            <span className="font-medium">{stallion.studLocation}</span>
          </div>
        )}
        {stallion.offspringCount > 0 && (
          <div>
            <span className="text-stone-400">Offspring:</span>{' '}
            <span className="font-medium">{stallion.offspringCount.toLocaleString()}</span>
          </div>
        )}
        {stallion.color && (
          <div>
            <span className="text-stone-400">Color:</span>{' '}
            <span className="font-medium">{stallion.color}</span>
          </div>
        )}
        {stallion.heightHands && (
          <div>
            <span className="text-stone-400">Height:</span>{' '}
            <span className="font-medium">{stallion.heightHands} hh</span>
          </div>
        )}
        {stallion.registrationNumber && (
          <div>
            <span className="text-stone-400">Registration #:</span>{' '}
            <span className="font-medium font-mono">{stallion.registrationNumber}</span>
          </div>
        )}
        {stallion.externalProfileUrl && (
          <div className="sm:col-span-2">
            <a href={stallion.externalProfileUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand-700 hover:underline">
              View official registry profile →
            </a>
          </div>
        )}
      </div>

      {stallion.offspringPerformanceSummary && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Offspring Performance</h2>
          <p className="text-sm text-stone-700 whitespace-pre-line">
            {stallion.offspringPerformanceSummary}
          </p>
        </div>
      )}

      {stallion.epdNotes && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">EPD / Breeding Values</h2>
          <p className="text-sm text-stone-700 whitespace-pre-line">{stallion.epdNotes}</p>
          <p className="text-xs text-stone-400 mt-2 italic">Source: manually entered from registry records. Verify against official studbook before breeding decisions.</p>
        </div>
      )}

      {stallion.conformationNotes && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Conformation Notes</h2>
          <p className="text-sm text-stone-700">{stallion.conformationNotes}</p>
        </div>
      )}

      {Object.keys(pedigree).length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Pedigree</h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {Object.entries(pedigree).map(([key, val]) => (
              <div key={key}>
                <span className="text-stone-400 text-xs">{key.replace(/_/g, ' ')}:</span>{' '}
                <span>{(val as any)?.name ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progeny Sale Stats */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Progeny Sale Stats</h2>
        {!saleStats || saleStats.count === 0 ? (
          <p className="text-sm text-stone-400">No auction data recorded.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {([['Avg', saleStats.avg], ['Median', saleStats.median], ['High', saleStats.high], ['Low', saleStats.low]] as [string, number | null][]).map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-stone-400">{label}</p>
                  <p className="font-medium">{val != null ? val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-2">{saleStats.count} sale{saleStats.count !== 1 ? 's' : ''} recorded</p>
            {saleStats.lowSampleWarning && (
              <p className="text-xs text-yellow-600 mt-1">Low sample — fewer than 3 sales</p>
            )}
          </>
        )}
      </div>

      <GeneticRiskPanel mareBreed="" stallionBreed={stallion.breed} discipline={stallion.discipline} />
    </div>
  )
}
