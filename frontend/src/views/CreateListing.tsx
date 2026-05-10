import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getMares } from '@/api/mares'
import {
  useCreateListing,
  useRequestUploadUrl,
  useConfigureListing,
} from '@/api/auctions'
import type { AuctionListing, ConfigureListingData } from '@/api/auctions'
import { toast } from 'sonner'

const REQUIRED_DOCS = [
  { docType: 'coggins_test', label: 'Coggins Test' },
  { docType: 'vet_certificate', label: 'Vet Certificate' },
  { docType: 'registration_papers', label: 'Registration Papers' },
  { docType: 'bill_of_sale', label: 'Bill of Sale' },
  { docType: 'ownership_transfer', label: 'Ownership Transfer Certificate' },
] as const

const OPTIONAL_DOCS = [
  { docType: 'radiographs', label: 'Radiographs' },
  { docType: 'endoscopy_video', label: 'Endoscopy Video' },
] as const

type DocType = typeof REQUIRED_DOCS[number]['docType'] | typeof OPTIONAL_DOCS[number]['docType']

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

interface DocUploadState {
  file: File | null
  status: UploadStatus
  progress: number
}

const emptyDoc = (): DocUploadState => ({ file: null, status: 'idle', progress: 0 })

const RESERVE_BEHAVIORS = [
  { value: 'auto_pass', label: 'Auto Pass' },
  { value: 'seller_decision', label: 'Seller Decision' },
  { value: 'counter_offer', label: 'Counter Offer' },
] as const

export default function CreateListing() {
  const [searchParams] = useSearchParams()
  const [selectedHorseId, setSelectedHorseId] = useState('')

  useEffect(() => {
    const preselect = searchParams.get('horseId')
    if (preselect) setSelectedHorseId(preselect)
  }, [])
  const [listing, setListing] = useState<AuctionListing | null>(null)
  const [docs, setDocs] = useState<Record<string, DocUploadState>>({
    coggins_test: emptyDoc(),
    vet_certificate: emptyDoc(),
    registration_papers: emptyDoc(),
    radiographs: emptyDoc(),
    endoscopy_video: emptyDoc(),
  })
  const [configForm, setConfigForm] = useState<ConfigureListingData>({
    startAt: '',
    durationMinutes: 60,
    startingBid: 100000,
    bidIncrement: 5000,
    reserveBehavior: 'auto_pass',
    buyersPremiumPct: 10,
  })

  const { data: horses = [], isLoading: horsesLoading } = useQuery({
    queryKey: ['myHorses'],
    queryFn: getMares,
  })

  const createListing = useCreateListing()
  const requestUploadUrl = useRequestUploadUrl()
  const configureListing = useConfigureListing()

  const handleCreateListing = () => {
    if (!selectedHorseId) { toast.error('Select a horse first'); return }
    createListing.mutate(selectedHorseId, {
      onSuccess: (newListing) => setListing(newListing),
      onError: () => toast.error('Failed to create listing'),
    })
  }

  const handleFileSelect = (docType: DocType, file: File | null) => {
    setDocs((prev) => ({ ...prev, [docType]: { file, status: 'idle', progress: 0 } }))
  }

  const handleUpload = (docType: DocType) => {
    const doc = docs[docType]
    if (!doc.file || !listing) return

    setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'uploading', progress: 0 } }))

    requestUploadUrl.mutate(
      { listingId: listing.id, docType, fileName: doc.file!.name, mimeType: doc.file!.type },
      {
        onSuccess: ({ uploadUrl }) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100)
              setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], progress: pct } }))
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'done', progress: 100 } }))
            } else {
              setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'error' } }))
              toast.error(`Upload failed for ${docType}`)
            }
          }
          xhr.onerror = () => {
            setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'error' } }))
            toast.error(`Upload failed for ${docType}`)
          }
          xhr.open('PUT', uploadUrl)
          xhr.setRequestHeader('Content-Type', doc.file!.type)
          xhr.send(doc.file)
        },
        onError: () => {
          setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], status: 'error' } }))
          toast.error('Failed to get upload URL')
        },
      }
    )
  }

  const handleConfigure = () => {
    if (!listing) return
    if (!configForm.startAt) { toast.error('Start date is required'); return }
    if (configForm.startingBid <= 0) { toast.error('Starting bid must be positive'); return }
    if (configForm.bidIncrement <= 0) { toast.error('Bid increment must be positive'); return }

    configureListing.mutate(
      { listingId: listing.id, data: configForm },
      {
        onSuccess: (updated) => {
          setListing(updated)
          toast.success('Auction configured successfully')
        },
        onError: () => toast.error('Failed to configure auction'),
      }
    )
  }

  // Step 3: listing is approved — show configure form
  if (listing?.status === 'approved') {
    return (
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Configure Auction</h1>
          <p className="text-sm text-stone-500 mt-1">Your listing has been approved. Set auction parameters to schedule it.</p>
        </div>

        <div className="space-y-4 bg-white border border-stone-200 rounded-lg p-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Start Date &amp; Time</label>
            <input
              type="datetime-local"
              value={configForm.startAt}
              onChange={(e) => setConfigForm((f) => ({ ...f, startAt: e.target.value }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={configForm.durationMinutes}
              onChange={(e) => setConfigForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) || 60 }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Starting Bid (cents)</label>
            <input
              type="number"
              min={1}
              value={configForm.startingBid}
              onChange={(e) => setConfigForm((f) => ({ ...f, startingBid: parseInt(e.target.value) || 0 }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Reserve Price (cents, optional)</label>
            <input
              type="number"
              min={1}
              value={configForm.reservePrice ?? ''}
              onChange={(e) => setConfigForm((f) => ({ ...f, reservePrice: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Bid Increment (cents)</label>
            <input
              type="number"
              min={1}
              value={configForm.bidIncrement}
              onChange={(e) => setConfigForm((f) => ({ ...f, bidIncrement: parseInt(e.target.value) || 0 }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Reserve Behavior</label>
            <select
              value={configForm.reserveBehavior}
              onChange={(e) => setConfigForm((f) => ({ ...f, reserveBehavior: e.target.value as ConfigureListingData['reserveBehavior'] }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {RESERVE_BEHAVIORS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Buyer's Premium (%)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={configForm.buyersPremiumPct ?? 10}
              onChange={(e) => setConfigForm((f) => ({ ...f, buyersPremiumPct: parseFloat(e.target.value) || 0 }))}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <button
            onClick={handleConfigure}
            disabled={configureListing.isPending}
            className="w-full bg-stone-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {configureListing.isPending ? 'Scheduling...' : 'Schedule Auction'}
          </button>
        </div>
      </div>
    )
  }

  // Step 2: listing created, awaiting approval
  if (listing && listing.status === 'pending_review') {
    return (
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Upload Vetting Documents</h1>
          <p className="text-sm text-stone-500 mt-1">Upload the required documents. Once all are submitted, your listing will be reviewed.</p>
        </div>

        <div className="space-y-4 bg-white border border-stone-200 rounded-lg p-6">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">Required Documents</p>
          {REQUIRED_DOCS.map(({ docType, label }) => (
            <DocUploadRow
              key={docType}
              label={label}
              state={docs[docType]}
              onFileSelect={(f) => handleFileSelect(docType, f)}
              onUpload={() => handleUpload(docType)}
            />
          ))}

          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide pt-2">Optional Documents</p>
          {OPTIONAL_DOCS.map(({ docType, label }) => (
            <DocUploadRow
              key={docType}
              label={label}
              state={docs[docType]}
              onFileSelect={(f) => handleFileSelect(docType, f)}
              onUpload={() => handleUpload(docType)}
            />
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium">Awaiting vetting review</p>
          <p className="text-xs text-amber-700 mt-1">After uploading all required documents, an admin will review your listing. You'll be notified once it's approved.</p>
        </div>
      </div>
    )
  }

  // Step 1: select horse and create listing
  return (
    <div className="max-w-lg mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-800">List a Horse for Auction</h1>
        <p className="text-sm text-stone-500 mt-1">Select a horse from your account to begin the listing process.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Select Horse</label>
          {horsesLoading ? (
            <p className="text-sm text-stone-400">Loading horses...</p>
          ) : horses.length === 0 ? (
            <p className="text-sm text-stone-400">No horses in your account. Add a horse first.</p>
          ) : (
            <select
              value={selectedHorseId}
              onChange={(e) => setSelectedHorseId(e.target.value)}
              className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="">— Select a horse —</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.breed}, {h.sex})
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={handleCreateListing}
          disabled={!selectedHorseId || createListing.isPending}
          className="w-full bg-stone-800 text-white rounded px-4 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
        >
          {createListing.isPending ? 'Creating...' : 'Start Listing'}
        </button>
      </div>
    </div>
  )
}

interface DocUploadRowProps {
  label: string
  state: DocUploadState
  onFileSelect: (f: File | null) => void
  onUpload: () => void
}

function DocUploadRow({ label, state, onFileSelect, onUpload }: DocUploadRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700">{label}</p>
        {state.status === 'uploading' && (
          <div className="mt-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-stone-600 transition-all" style={{ width: `${state.progress}%` }} />
          </div>
        )}
        {state.status === 'done' && <p className="text-xs text-green-600 mt-0.5">Uploaded</p>}
        {state.status === 'error' && <p className="text-xs text-red-600 mt-0.5">Upload failed — try again</p>}
      </div>

      <input
        type="file"
        id={`file-${label}`}
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
      />

      {state.status !== 'done' && (
        <label
          htmlFor={`file-${label}`}
          className="cursor-pointer text-xs border border-stone-200 px-2 py-1 rounded hover:bg-stone-50 text-stone-600 whitespace-nowrap"
        >
          {state.file ? state.file.name.slice(0, 16) + '…' : 'Choose file'}
        </label>
      )}

      {state.file && state.status === 'idle' && (
        <button
          onClick={onUpload}
          className="text-xs bg-stone-800 text-white px-2 py-1 rounded hover:bg-stone-700 whitespace-nowrap"
        >
          Upload
        </button>
      )}
    </div>
  )
}
