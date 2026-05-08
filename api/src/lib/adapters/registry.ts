import { prisma } from '../prisma'
import type { AuctionHouseAdapter, AuctionSource } from './types'

const adapters = new Map<AuctionSource, AuctionHouseAdapter>()
const activeAdapters = new Set<AuctionSource>()

export function registerAdapter(source: AuctionSource, adapter: AuctionHouseAdapter): void {
  adapters.set(source, adapter)
}

export function listRegistered(): AuctionSource[] {
  return Array.from(adapters.keys())
}

export function listActive(): AuctionSource[] {
  return Array.from(activeAdapters)
}

export function getAdapter(source: AuctionSource): AuctionHouseAdapter | undefined {
  return adapters.get(source)
}

export async function activateAdapter(source: AuctionSource): Promise<void> {
  const adapter = adapters.get(source)
  if (!adapter) throw new Error(`No adapter registered for source: ${source}`)
  try {
    await adapter.connect()
    activeAdapters.add(source)
    await prisma.adapterConfig.upsert({
      where: { source },
      update: { active: true },
      create: { source, active: true },
    })
  } catch (err) {
    activeAdapters.delete(source)
    await prisma.adapterConfig.upsert({
      where: { source },
      update: { active: false },
      create: { source, active: false },
    }).catch(() => {})
    throw err
  }
}

export async function deactivateAdapter(source: AuctionSource): Promise<void> {
  const adapter = adapters.get(source)
  if (adapter) {
    try { await adapter.disconnect() } catch (e) { console.error('[registry] disconnect failed', e) }
  }
  activeAdapters.delete(source)
  await prisma.adapterConfig.upsert({
    where: { source },
    update: { active: false },
    create: { source, active: false },
  }).catch(() => {})
}

export async function initRegistry(): Promise<void> {
  let configs: Array<{ source: string; active: boolean }> = []
  try {
    configs = await prisma.adapterConfig.findMany({ where: { active: true } })
  } catch (e) {
    console.error('[registry] failed to load adapter configs', e)
    return
  }
  for (const config of configs) {
    try {
      await activateAdapter(config.source as AuctionSource)
    } catch (e) {
      console.error(`[registry] failed to activate ${config.source} on startup`, e)
    }
  }
}
