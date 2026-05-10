import client from './client'

export interface ImportProvider {
  provider: string
  configured: boolean
  testStatus: string | null
  platformManaged?: boolean
  active?: boolean
  maskedCredential?: string
}

export interface PreviewRow {
  horseName?: string
  sire?: string
  dam?: string
  hipNumber?: string
  saleDate?: string
  hammerPrice?: string
  _status: 'valid' | 'error' | 'matched'
  _errors: string[]
  _ignored: Record<string, string>
  matchedHorseId?: string
}

export interface ImportBatch {
  id: string
  source: string
  provider?: string
  sourceFileName?: string
  totalRows: number
  createdCount: number
  matchedCount: number
  errorCount: number
  status: string
  createdAt: string
}

export interface ExecuteSummary extends ImportBatch {
  errorLog: Array<{ rowIndex: number; error: string }>
}

export interface UploadResult {
  headers: string[]
  preview: Record<string, string>[]
  totalRows: number
  rawRows: Record<string, string>[]
}

export interface PreviewResult {
  validCount: number
  matchedCount: number
  errorCount: number
  rows: PreviewRow[]
}

export const uploadCSV = (file: File): Promise<UploadResult> => {
  const form = new FormData()
  form.append('file', file)
  return client.post<UploadResult>('/api/import/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const previewImport = (payload: {
  mappingConfig: Record<string, string>
  rows: Record<string, string>[]
}): Promise<PreviewResult> =>
  client.post<PreviewResult>('/api/import/preview', payload).then((r) => r.data)

export const executeImport = (payload: {
  mappingConfig: Record<string, string>
  rows: Record<string, string>[]
  ownership: 'personal' | 'shared'
  presetName?: string
  sourceFileName?: string
}): Promise<ExecuteSummary> =>
  client.post<ExecuteSummary>('/api/import/execute', payload).then((r) => r.data)

export const getHistory = (): Promise<{ batches: ImportBatch[] }> =>
  client.get('/api/import/history').then((r) => r.data)

export const getBatch = (id: string): Promise<ExecuteSummary> =>
  client.get(`/api/import/history/${id}`).then((r) => r.data)

export const getProviders = (): Promise<{ providers: ImportProvider[] }> =>
  client.get('/api/import/providers').then((r) => r.data)

export const searchProvider = (
  provider: string,
  q: string
): Promise<{ results: Array<{ name: string; providerRef: string; sire?: string; dam?: string }> }> =>
  client.get(`/api/import/providers/${provider}/search`, { params: { q } }).then((r) => r.data)

export const getPresets = (): Promise<string[]> =>
  Promise.resolve(['keeneland', 'fasig_tipton', 'obs', 'saratoga', 'generic'])
