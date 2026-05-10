import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  uploadCSV, previewImport, executeImport, getProviders, searchProvider, getPresets, linkPedigree,
  type UploadResult, type PreviewResult, type ExecuteSummary, type ImportProvider, type PedigreeSuggestion,
} from '@/api/import'

type Step = 'source' | 'configure' | 'preview'
type SourceMode = 'csv' | 'api'

const IMPORT_FIELDS = [
  'horseName', 'sex', 'breed', 'sire', 'dam', 'damsire',
  'dateOfBirth', 'hipNumber', 'saleDate', 'saleSessionName',
  'hammerPrice', 'buyerName', 'consignorName', 'registrationNumber',
] as const

export default function Import() {
  const [step, setStep] = useState<Step>('source')
  const [sourceMode, setSourceMode] = useState<SourceMode>('csv')
  const [providers, setProviders] = useState<ImportProvider[]>([])
  const [presets, setPresets] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [mappingConfig, setMappingConfig] = useState<Record<string, string>>({})
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [ownership, setOwnership] = useState<'personal' | 'shared'>('personal')
  const [summary, setSummary] = useState<ExecuteSummary | null>(null)
  const [pedigreeSuggestions, setPedigreeSuggestions] = useState<PedigreeSuggestion[]>([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiRows, setApiRows] = useState<Record<string, string>[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')

  useEffect(() => {
    getProviders().then((r) => setProviders(r.providers)).catch(() => {})
    getPresets().then(setPresets).catch(() => {})
  }, [])

  const horseNameMapped = Object.keys(mappingConfig).some((k) => mappingConfig[k] === 'horseName')

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const result = await uploadCSV(file)
      setUploadResult(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePreview = async () => {
    if (!uploadResult && apiRows.length === 0) return
    setError(null)
    try {
      const rows = uploadResult ? uploadResult.rawRows : apiRows
      const result = await previewImport({ mappingConfig, rows })
      setPreviewResult(result)
      setStep('preview')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    }
  }

  const handleExecute = async () => {
    if (!previewResult) return
    setExecuting(true)
    setError(null)
    try {
      const rows = uploadResult ? uploadResult.rawRows : apiRows
      const result = await executeImport({ mappingConfig, rows, ownership })
      setSummary(result)
      setPedigreeSuggestions(result.pedigreeSuggestions ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setExecuting(false)
    }
  }

  const handleSearch = async () => {
    if (!selectedProvider || searchQuery.length < 2) return
    try {
      const result = await searchProvider(selectedProvider, searchQuery)
      setApiRows(result.results.map((r) => ({
        horseName: r.name,
        sire: r.sire ?? '',
        dam: r.dam ?? '',
        _providerRef: r.providerRef,
      })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    }
  }

  const reset = () => {
    setStep('source')
    setUploadResult(null)
    setMappingConfig({})
    setPreviewResult(null)
    setSummary(null)
    setPedigreeSuggestions([])
    setDismissedSuggestions(new Set())
    setError(null)
    setApiRows([])
    setSelectedPreset('')
  }

  const handleLinkPedigree = async (suggestion: PedigreeSuggestion) => {
    try {
      await linkPedigree({ horseId: suggestion.importedHorseId, field: suggestion.field, targetHorseId: suggestion.matchedHorseId })
      setDismissedSuggestions((prev) => new Set([...prev, `${suggestion.importedHorseId}:${suggestion.field}`]))
    } catch {
      // silently fail — suggestion stays visible
    }
  }

  if (summary) {
    const pendingSuggestions = pedigreeSuggestions.filter(
      (s) => !dismissedSuggestions.has(`${s.importedHorseId}:${s.field}`)
    )
    return (
      <div className="max-w-xl mx-auto mt-12 p-8 bg-stone-900 rounded-xl space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Import Complete</h2>
          <div className="space-y-2 text-stone-300">
            <p>Created: <span className="text-green-400 font-bold">{summary.createdCount}</span></p>
            <p>Matched: <span className="text-yellow-400 font-bold">{summary.matchedCount}</span></p>
            <p>Errors: <span className="text-red-400 font-bold">{summary.errorCount}</span></p>
          </div>
        </div>

        {pendingSuggestions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-stone-300 mb-2">Pedigree Suggestions</h3>
            <p className="text-xs text-stone-500 mb-3">We found existing horses that may match the sire/dam fields in your import. Link them to build the pedigree graph.</p>
            <div className="space-y-2">
              {pendingSuggestions.map((s) => (
                <div key={`${s.importedHorseId}:${s.field}`} className="flex items-center justify-between bg-stone-800 rounded-lg p-3 text-xs">
                  <div>
                    <span className="text-stone-400 uppercase tracking-wide mr-2">{s.field}</span>
                    <span className="text-stone-200 font-medium">{s.matchedHorseName}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLinkPedigree(s)}
                      className="px-2 py-1 bg-brand-700 text-white rounded"
                    >
                      Link
                    </button>
                    <button
                      onClick={() => setDismissedSuggestions((prev) => new Set([...prev, `${s.importedHorseId}:${s.field}`]))}
                      className="px-2 py-1 bg-stone-600 text-stone-300 rounded"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={reset} className="px-4 py-2 bg-brand-700 text-white rounded-lg">Import Another</button>
          <Link to="/import/history" className="px-4 py-2 bg-stone-700 text-white rounded-lg">View History</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4">
      <h1 className="text-2xl font-bold text-white mb-6">Import Sale Data</h1>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {(['source', 'configure', 'preview'] as Step[]).map((s, i) => (
          <div key={s} className={`flex items-center gap-2 text-sm ${step === s ? 'text-brand-400' : 'text-stone-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-brand-700 text-white' : 'bg-stone-700'}`}>{i + 1}</span>
            <span className="capitalize">{s}</span>
            {i < 2 && <span className="text-stone-600">→</span>}
          </div>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">{error}</div>}

      {/* Step 1: Source */}
      {step === 'source' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
              <input type="radio" name="source" value="csv" checked={sourceMode === 'csv'} onChange={() => setSourceMode('csv')} />
              Upload CSV
            </label>
            <label className="flex items-center gap-2 text-stone-300 cursor-pointer">
              <input type="radio" name="source" value="api" checked={sourceMode === 'api'} onChange={() => setSourceMode('api')} />
              API Pull
            </label>
          </div>
          {sourceMode === 'api' && (
            <div className="space-y-3">
              <p className="text-stone-400 text-sm">Available providers:</p>
              {providers.length === 0 && (
                <p className="text-stone-500 text-sm">No providers configured. <Link to="/settings" className="text-brand-400 underline">Go to Settings</Link>.</p>
              )}
              {providers.map((p) => (
                <div key={p.provider} className="flex items-center justify-between p-3 bg-stone-800 rounded-lg">
                  <span className="text-stone-300 capitalize">{p.provider.replace(/_/g, ' ')}</span>
                  {p.configured ? (
                    <button onClick={() => { setSelectedProvider(p.provider); setStep('configure') }} className="text-sm text-brand-400">Use this provider</button>
                  ) : (
                    <Link to="/settings" className="text-sm text-stone-500 underline">Connect in Settings</Link>
                  )}
                </div>
              ))}
            </div>
          )}
          {sourceMode === 'csv' && (
            <button onClick={() => setStep('configure')} className="px-4 py-2 bg-brand-700 text-white rounded-lg">Next</button>
          )}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 'configure' && (
        <div className="space-y-4">
          {sourceMode === 'csv' && (
            <>
              <div>
                <label className="block text-stone-300 text-sm mb-1">Upload CSV file</label>
                <input
                  type="file"
                  accept=".csv"
                  disabled={uploading}
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                  className="text-stone-300 text-sm"
                />
                {uploading && <p className="text-stone-400 text-xs mt-1">Parsing…</p>}
                {uploadResult && <p className="text-green-400 text-xs mt-1">{uploadResult.totalRows} rows parsed</p>}
              </div>
              {uploadResult && (
                <>
                  <div>
                    <label className="block text-stone-300 text-sm mb-1">Preset</label>
                    <select
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                      className="bg-stone-800 text-stone-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="">None</option>
                      {presets.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-stone-300 text-sm mb-2">Column mapping <span className="text-red-400">*</span> horseName required</p>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {uploadResult.headers.map((header) => (
                        <div key={header} className="flex items-center gap-3">
                          <span className="text-stone-400 text-xs w-40 truncate">{header}</span>
                          <span className="text-stone-600 text-xs">→</span>
                          <select
                            value={mappingConfig[header] ?? ''}
                            onChange={(e) => setMappingConfig((m) => ({ ...m, [header]: e.target.value }))}
                            className="bg-stone-800 text-stone-300 text-xs rounded px-2 py-1"
                          >
                            <option value="">Ignore</option>
                            {IMPORT_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {sourceMode === 'api' && (
            <div className="space-y-3">
              <p className="text-stone-400 text-sm">Search {selectedProvider.replace(/_/g, ' ')}</p>
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Horse name..."
                  className="bg-stone-800 text-stone-300 rounded px-3 py-1 text-sm flex-1"
                />
                <button onClick={handleSearch} className="px-3 py-1 bg-brand-700 text-white rounded text-sm">Search</button>
              </div>
              {apiRows.length > 0 && (
                <p className="text-green-400 text-xs">{apiRows.length} results — will import all</p>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep('source')} className="px-4 py-2 bg-stone-700 text-white rounded-lg text-sm">Back</button>
            <button
              onClick={handlePreview}
              disabled={sourceMode === 'csv' ? (!uploadResult || !horseNameMapped) : apiRows.length === 0}
              className="px-4 py-2 bg-brand-700 text-white rounded-lg text-sm disabled:opacity-40"
            >
              Preview
            </button>
          </div>
          {sourceMode === 'csv' && uploadResult && !horseNameMapped && (
            <p className="text-amber-400 text-xs">Map a column to &quot;horseName&quot; to continue</p>
          )}
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && previewResult && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{previewResult.validCount} valid</span>
            <span className="text-yellow-400">{previewResult.matchedCount} matched</span>
            <span className="text-red-400">{previewResult.errorCount} errors</span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {previewResult.rows.slice(0, 50).map((row, i) => (
              <div key={i} className={`text-xs p-2 rounded flex justify-between ${
                row._status === 'valid' ? 'bg-green-900/30' :
                row._status === 'matched' ? 'bg-yellow-900/30' : 'bg-red-900/30'
              }`}>
                <span className="text-stone-300">{row.horseName ?? '(unnamed)'}</span>
                <span className={row._status === 'error' ? 'text-red-400' : row._status === 'matched' ? 'text-yellow-400' : 'text-green-400'}>
                  {row._status === 'error' ? row._errors[0] : row._status}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-stone-300 text-sm cursor-pointer">
              <input type="radio" name="ownership" value="personal" checked={ownership === 'personal'} onChange={() => setOwnership('personal')} />
              Add to my catalog
            </label>
            <label className="flex items-center gap-2 text-stone-300 text-sm cursor-pointer">
              <input type="radio" name="ownership" value="shared" checked={ownership === 'shared'} onChange={() => setOwnership('shared')} />
              Contribute to shared catalog
            </label>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('configure')} className="px-4 py-2 bg-stone-700 text-white rounded-lg text-sm">Back</button>
            <button onClick={handleExecute} disabled={executing} className="px-4 py-2 bg-brand-700 text-white rounded-lg text-sm disabled:opacity-40">
              {executing ? 'Importing…' : 'Import valid rows only'}
            </button>
            <button onClick={reset} className="px-4 py-2 bg-stone-600 text-white rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
