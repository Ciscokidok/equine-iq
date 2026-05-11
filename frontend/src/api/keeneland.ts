import client from './client'

export interface KeenelandBatch {
  id: string
  sourceFileName: string
  status: string
  createdCount: number
  matchedCount: number
  errorCount: number
  totalRows: number
  createdAt: string
}

export interface KeenelandStatusResult {
  count: number
  batches: KeenelandBatch[]
}

export interface KeenelandSalePreview {
  sale_id: string
  name: string
  date: string
}

export interface KeenelandDryRunResult {
  dryRun: true
  eligible: number
  alreadyImported: number
  toImport: number
  sales: KeenelandSalePreview[]
}

export interface KeenelandSaleDetail {
  sale_id: string
  name: string
  date?: string
  status: 'imported' | 'skipped' | 'error'
  totalRows?: number
  created?: number
  matched?: number
  errors?: number
  reason?: string
}

export interface KeenelandSyncResult {
  eligible: number
  alreadyImported: number
  imported: number
  errored: number
  details: KeenelandSaleDetail[]
}

export interface KeenelandSyncStarted {
  started: true
  eligible: number
  alreadyImported: number
  toImport: number
}

export const getKeenelandStatus = (): Promise<KeenelandStatusResult> =>
  client.get<KeenelandStatusResult>('/api/import/keeneland/status').then((r) => r.data)

export const keenelandDryRun = (sinceYear: number): Promise<KeenelandDryRunResult> =>
  client.post<KeenelandDryRunResult>('/api/import/keeneland/sync', { sinceYear, dryRun: true }).then((r) => r.data)

export const keenelandSync = (sinceYear: number): Promise<KeenelandSyncStarted | KeenelandSyncResult> =>
  client.post('/api/import/keeneland/sync', { sinceYear }).then((r) => r.data)

export const keenelandCleanup = (): Promise<{ fixed: number; batches?: string[] }> =>
  client.post('/api/import/keeneland/cleanup').then((r) => r.data)
