import type { DataProvider, DataProviderAdapter } from './types'
import { SporthorseDataAdapter } from './SporthorseDataAdapter'
import { EquibaseAdapter } from './EquibaseAdapter'
import { TJCISAdapter } from './TJCISAdapter'

export function getAdapter(provider: DataProvider, credential: string): DataProviderAdapter {
  switch (provider) {
    case 'sporthorse_data': return new SporthorseDataAdapter(credential)
    case 'equibase': return new EquibaseAdapter(credential)
    case 'tjcis': return new TJCISAdapter(credential)
    default: throw new Error(`Unknown provider: ${provider}`)
  }
}
