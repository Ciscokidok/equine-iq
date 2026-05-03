import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getStallion } from '@/api/stallions'
import GeneticRiskPanel from '@/components/GeneticRiskPanel'

export default function StallionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: stallion, isLoading, isError } = useQuery({
    queryKey: ['stallion', id],
    queryFn: () => getStallion(id!),
  })

  if (isLoading) return <p className="text-sm text-stone-400">Loading…</p>
  if (isError || !stallion) return <p className="text-sm text-red-500">Stallion not found.</p>

  const pedigree = stallion.pedigree as Record<string, any>
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
      </div>

      {stallion.offspringPerformanceSummary && (
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Offspring Performance</h2>
          <p className="text-sm text-stone-700 whitespace-pre-line">
            {stallion.offspringPerformanceSummary}
          </p>
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

      <GeneticRiskPanel mareBreed="" stallionBreed={stallion.breed} discipline={stallion.discipline} />
    </div>
  )
}
