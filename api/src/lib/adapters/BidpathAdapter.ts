import type { AuctionHouseAdapter, AuctionSource, LotStateEvent, BidRequest, BidAckEvent } from './types'

export class BidpathAdapter implements AuctionHouseAdapter {
  readonly source: AuctionSource = 'bidpath'
  private handlers: Array<(e: LotStateEvent) => void> = []

  async connect(): Promise<void> {
    throw new Error('Bidpath partnership not active — contact partnerships@equineiq.com')
  }

  async disconnect(): Promise<void> {
    // no-op — never connected
  }

  async placeBid(_req: BidRequest): Promise<BidAckEvent> {
    throw new Error('Bidpath partnership not active — contact partnerships@equineiq.com')
  }

  onLotStateUpdate(handler: (e: LotStateEvent) => void): void {
    this.handlers.push(handler)
  }

  isHealthy(): boolean {
    return false
  }
}
