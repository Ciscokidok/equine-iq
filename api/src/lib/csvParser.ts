import { parse as parseSync } from 'csv-parse/sync'
import type { ImportField } from './columnMappingPresets'

export type { ImportField }

export type ColumnMappingConfig = Partial<Record<ImportField, string>>

export type MappedRow = {
  [K in ImportField]?: string
} & { _ignored: Record<string, string> }

export type ValidatedRow = MappedRow & {
  _status: 'valid' | 'error'
  _errors: string[]
}

export function parseCSV(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const rows = parseSync(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows }
}

export function applyMapping(rows: Record<string, string>[], config: ColumnMappingConfig): MappedRow[] {
  // Build reverse map: CSV column name → ImportField
  const reverseMap = new Map<string, ImportField>()
  for (const [field, csvColumn] of Object.entries(config) as [ImportField, string][]) {
    if (csvColumn) reverseMap.set(csvColumn, field)
  }

  return rows.map((row) => {
    const mapped: MappedRow = { _ignored: {} }
    for (const [csvCol, value] of Object.entries(row)) {
      const field = reverseMap.get(csvCol)
      if (field) {
        mapped[field] = value
      } else {
        mapped._ignored[csvCol] = value
      }
    }
    return mapped
  })
}

export function validateRows(rows: MappedRow[]): ValidatedRow[] {
  return rows.map((row) => {
    const errors: string[] = []

    if (!row.horseName?.trim()) {
      errors.push('Missing: Horse Name')
    }

    if (row.dateOfBirth !== undefined && row.dateOfBirth.trim() !== '') {
      if (isNaN(Date.parse(row.dateOfBirth.trim()))) {
        errors.push('Invalid date: dateOfBirth')
      }
    }

    if (row.saleDate !== undefined && row.saleDate.trim() !== '') {
      if (isNaN(Date.parse(row.saleDate.trim()))) {
        errors.push('Invalid date: saleDate')
      }
    }

    if (row.hammerPrice !== undefined && row.hammerPrice.trim() !== '') {
      const stripped = row.hammerPrice.replace(/[$£€,]/g, '').trim()
      if (isNaN(parseFloat(stripped))) {
        errors.push('Invalid price: hammerPrice')
      }
    }

    return {
      ...row,
      _status: errors.length > 0 ? 'error' : 'valid',
      _errors: errors,
    }
  })
}

export function normalizePrice(raw: string): number {
  if (!raw || !raw.trim()) return 0
  const stripped = raw.replace(/[$£€,]/g, '').trim()
  const parsed = parseFloat(stripped)
  if (isNaN(parsed)) return 0
  return Math.round(parsed * 100)
}
