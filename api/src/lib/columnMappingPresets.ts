export type ImportField =
  | 'horseName'
  | 'sex'
  | 'breed'
  | 'sire'
  | 'dam'
  | 'damsire'
  | 'dateOfBirth'
  | 'hipNumber'
  | 'saleDate'
  | 'saleSessionName'
  | 'hammerPrice'
  | 'buyerName'
  | 'consignorName'
  | 'registrationNumber'

export interface ColumnMappingPreset {
  name: string
  displayName: string
  defaultDiscipline: string
  columns: Partial<Record<ImportField, string>>
}

export const PRESETS: Record<string, ColumnMappingPreset> = {
  keeneland: {
    name: 'keeneland',
    displayName: 'Keeneland',
    defaultDiscipline: 'thoroughbred_racing',
    columns: {
      hipNumber: 'Hip',
      horseName: 'Horse Name',
      sex: 'Sex',
      sire: 'Sire',
      dam: 'Dam',
      dateOfBirth: 'DOB',
      saleSessionName: 'Session',
      hammerPrice: 'Price',
      buyerName: 'Purchaser',
      consignorName: 'PropertyLine1',
    },
  },
  fasig_tipton: {
    // NOTE: verify against actual export sample
    name: 'fasig_tipton',
    displayName: 'Fasig-Tipton',
    defaultDiscipline: 'thoroughbred_racing',
    columns: {
      hipNumber: 'Hip',
      horseName: 'Name',
      sex: 'Sex',
      breed: 'Breed',
      sire: 'Sire',
      dam: 'Dam',
      damsire: 'Damsire',
      dateOfBirth: 'YOB',
      saleDate: 'Date',
      saleSessionName: 'Session',
      hammerPrice: 'Hammer Price',
      buyerName: 'Purchaser',
      consignorName: 'Consignor',
      registrationNumber: 'Registration',
    },
  },
  obs: {
    // NOTE: verify against actual export sample
    name: 'obs',
    displayName: 'OBS (Ocala Breeders Sales)',
    defaultDiscipline: 'thoroughbred_racing',
    columns: {
      hipNumber: 'Hip #',
      horseName: 'Horse Name',
      sex: 'Sex',
      breed: 'Breed',
      sire: 'Sire',
      dam: 'Dam',
      damsire: 'Damsire',
      dateOfBirth: 'Foal Date',
      saleDate: 'Sale Date',
      saleSessionName: 'Session',
      hammerPrice: 'Sale Price',
      buyerName: 'Buyer',
      consignorName: 'Consignor',
      registrationNumber: 'Jockey Club #',
    },
  },
  saratoga: {
    // NOTE: verify against actual export sample
    name: 'saratoga',
    displayName: 'Saratoga',
    defaultDiscipline: 'thoroughbred_racing',
    columns: {
      hipNumber: 'Hip',
      horseName: 'Horse',
      sex: 'Sex',
      breed: 'Breed',
      sire: 'Sire',
      dam: 'Dam',
      damsire: 'Dam Sire',
      dateOfBirth: 'Foaling Year',
      saleDate: 'Date',
      saleSessionName: 'Session',
      hammerPrice: 'Price',
      buyerName: 'Buyer',
      consignorName: 'Consignor',
      registrationNumber: 'Reg No',
    },
  },
  generic: {
    // NOTE: verify against actual export sample
    name: 'generic',
    displayName: 'Generic',
    defaultDiscipline: 'other',
    columns: {
      hipNumber: 'Hip Number',
      horseName: 'Horse Name',
      sex: 'Sex',
      breed: 'Breed',
      sire: 'Sire',
      dam: 'Dam',
      damsire: 'Damsire',
      dateOfBirth: 'Date of Birth',
      saleDate: 'Sale Date',
      saleSessionName: 'Session',
      hammerPrice: 'Hammer Price',
      buyerName: 'Buyer',
      consignorName: 'Consignor',
      registrationNumber: 'Registration Number',
    },
  },
  // NOTE: verify against actual AQHA export sample
  aqha: {
    name: 'aqha',
    displayName: 'AQHA Sales',
    defaultDiscipline: 'quarter_horse',
    columns: {
      horseName: 'Horse Name',
      sex: 'Sex',
      breed: 'Breed',
      sire: 'Sire',
      dam: 'Dam',
      dateOfBirth: 'Foaling Date',
      hipNumber: 'Hip Number',
      saleDate: 'Sale Date',
      hammerPrice: 'Sale Price',
      buyerName: 'Buyer',
      registrationNumber: 'AQHA Number',
    },
  },
  // NOTE: verify against actual KWPN export sample
  kwpn: {
    name: 'kwpn',
    displayName: 'KWPN / Warmblood',
    defaultDiscipline: 'warmblood',
    columns: {
      horseName: 'Name',
      sex: 'Gender',
      breed: 'Breed',
      sire: 'Sire',
      dam: 'Dam',
      damsire: 'Damsire',
      dateOfBirth: 'Date of Birth',
      hipNumber: 'Catalogue No.',
      saleDate: 'Sale Date',
      hammerPrice: 'Hammer Price',
      buyerName: 'Buyer',
      registrationNumber: 'KWPN Number',
    },
  },
}

export function getPreset(name: string): ColumnMappingPreset | null {
  return PRESETS[name] ?? null
}
