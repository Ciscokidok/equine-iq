export type AuctionSource = 'internal' | 'bidpath' | 'keeneland' | 'fasig_tipton' | 'obs'

export interface LotStateEvent {
  auctionSource: AuctionSource
  externalLotId: string
  currentBid: number // cents
  bidderInitials: string
  timeRemainingSeconds?: number
  status?: string
}

export interface BidRequest {
  externalLotId: string
  equineIqUserId: string
  amount: number // cents
  currency: string
}

export interface BidAckEvent {
  accepted: boolean
  rejectionReason?: string
  currentBid?: number // cents
}

export interface AuctionHouseAdapter {
  readonly source: AuctionSource
  connect(): Promise<void>
  disconnect(): Promise<void>
  placeBid(request: BidRequest): Promise<BidAckEvent>
  onLotStateUpdate(handler: (event: LotStateEvent) => void): void
  isHealthy(): boolean
}

export interface AdapterRegistry {
  register(adapter: AuctionHouseAdapter): void
  get(source: AuctionSource): AuctionHouseAdapter | undefined
  activate(source: AuctionSource): Promise<void>
  deactivate(source: AuctionSource): Promise<void>
  listActive(): AuctionSource[]
  listRegistered(): AuctionSource[]
}
