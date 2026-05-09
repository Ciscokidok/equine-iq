import { describe, it, expect } from 'vitest'
import { parseCSV, applyMapping, validateRows, normalizePrice } from '../src/lib/csvParser'
import { PRESETS } from '../src/lib/columnMappingPresets'

describe('parseCSV', () => {
  it('returns correct headers and row count for valid CSV', () => {
    const csv = `Horse,Sire,Dam\nSecretary,Bold Ruler,Somethingroyal\nCitation,Bull Lea,Hydroplane\nWhirlaway,Blenheim II,Dustwhirl\n`
    const { headers, rows } = parseCSV(Buffer.from(csv))
    expect(headers).toEqual(['Horse', 'Sire', 'Dam'])
    expect(rows).toHaveLength(3)
  })

  it('trims whitespace from values', () => {
    const csv = `Horse , Sire\n  Secretariat , Bold Ruler  \n`
    const { rows } = parseCSV(Buffer.from(csv))
    expect(rows[0]['Horse']).toBe('Secretariat')
    expect(rows[0]['Sire']).toBe('Bold Ruler')
  })

  it('returns empty headers for empty body', () => {
    const { headers, rows } = parseCSV(Buffer.from(''))
    expect(headers).toEqual([])
    expect(rows).toHaveLength(0)
  })

  it('skips empty lines', () => {
    const csv = `Horse,Sire\nSecretariat,Bold Ruler\n\nCitation,Bull Lea\n`
    const { rows } = parseCSV(Buffer.from(csv))
    expect(rows).toHaveLength(2)
  })
})

describe('applyMapping', () => {
  it('maps known Keeneland columns to ImportField keys', () => {
    const preset = PRESETS['keeneland']
    const rows = [{ 'Horse': 'Secretariat', 'Sire': 'Bold Ruler', 'Dam': 'Somethingroyal', 'Hip No.': '123' }]
    const mapped = applyMapping(rows, preset.columns)
    expect(mapped[0].horseName).toBe('Secretariat')
    expect(mapped[0].sire).toBe('Bold Ruler')
    expect(mapped[0].dam).toBe('Somethingroyal')
    expect(mapped[0].hipNumber).toBe('123')
  })

  it('puts unmapped columns into _ignored', () => {
    const rows = [{ 'Horse': 'Secretariat', 'UnknownColumn': 'mystery' }]
    const mapped = applyMapping(rows, { horseName: 'Horse' })
    expect(mapped[0].horseName).toBe('Secretariat')
    expect(mapped[0]._ignored['UnknownColumn']).toBe('mystery')
  })
})

describe('validateRows', () => {
  it('errors when horseName is missing', () => {
    const rows = applyMapping([{ 'Sire': 'Bold Ruler' }], { sire: 'Sire' })
    const validated = validateRows(rows)
    expect(validated[0]._status).toBe('error')
    expect(validated[0]._errors).toContain('Missing: Horse Name')
  })

  it('errors when dateOfBirth is an invalid date', () => {
    const rows = applyMapping(
      [{ 'Horse': 'Secretariat', 'DOB': 'not-a-date' }],
      { horseName: 'Horse', dateOfBirth: 'DOB' }
    )
    const validated = validateRows(rows)
    expect(validated[0]._status).toBe('error')
    expect(validated[0]._errors).toContain('Invalid date: dateOfBirth')
  })

  it('is valid for a complete correct row', () => {
    const rows = applyMapping(
      [{ 'Horse': 'Secretariat', 'DOB': '03/15/2024', 'Sale Date': '09/01/2024', 'Price': '250000' }],
      { horseName: 'Horse', dateOfBirth: 'DOB', saleDate: 'Sale Date', hammerPrice: 'Price' }
    )
    const validated = validateRows(rows)
    expect(validated[0]._status).toBe('valid')
    expect(validated[0]._errors).toHaveLength(0)
  })

  it('errors when hammerPrice is not a number', () => {
    const rows = applyMapping(
      [{ 'Horse': 'Secretariat', 'Price': 'N/A' }],
      { horseName: 'Horse', hammerPrice: 'Price' }
    )
    const validated = validateRows(rows)
    expect(validated[0]._status).toBe('error')
    expect(validated[0]._errors).toContain('Invalid price: hammerPrice')
  })

  it('accepts date in MM/DD/YYYY format', () => {
    const rows = applyMapping(
      [{ 'Horse': 'Secretariat', 'DOB': '03/15/2024' }],
      { horseName: 'Horse', dateOfBirth: 'DOB' }
    )
    const validated = validateRows(rows)
    expect(validated[0]._status).toBe('valid')
  })
})

describe('normalizePrice', () => {
  it('converts "$1,234.50" to 123450', () => {
    expect(normalizePrice('$1,234.50')).toBe(123450)
  })

  it('converts "2500" to 250000', () => {
    expect(normalizePrice('2500')).toBe(250000)
  })

  it('converts "0" to 0', () => {
    expect(normalizePrice('0')).toBe(0)
  })

  it('converts "5,000.00" to 500000', () => {
    expect(normalizePrice('5,000.00')).toBe(500000)
  })

  it('returns 0 for empty string', () => {
    expect(normalizePrice('')).toBe(0)
  })

  it('handles pound and euro symbols', () => {
    expect(normalizePrice('£1,000.00')).toBe(100000)
    expect(normalizePrice('€2,500.00')).toBe(250000)
  })
})
