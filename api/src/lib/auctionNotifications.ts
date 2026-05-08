import sgMail from '@sendgrid/mail'

const FROM = process.env.SENDGRID_FROM ?? 'noreply@example.com'

function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}

export async function sendInvoiceEmail(opts: {
  winnerEmail: string
  horseName: string
  hammerPrice: number
  buyersPremiumPct: number
  auctionId: string
}): Promise<void> {
  const premiumAmount = Math.round(opts.hammerPrice * opts.buyersPremiumPct / 100)
  const totalDue = opts.hammerPrice + premiumAmount
  if (isTest()) {
    console.log('[invoice]', { hammerPrice: opts.hammerPrice, premiumAmount, totalDue })
    return
  }
  try {
    await sgMail.send({
      to: opts.winnerEmail,
      from: FROM,
      subject: `Invoice: ${opts.horseName}`,
      text: `Congratulations on winning ${opts.horseName}!\n\nHammer price: $${(opts.hammerPrice / 100).toFixed(2)}\nBuyer\'s premium: $${(premiumAmount / 100).toFixed(2)}\nTotal due: $${(totalDue / 100).toFixed(2)}\n\nPayment is due within 48 hours. Wire transfer instructions will follow.`,
    })
  } catch (e) {
    console.error('[invoice] sendgrid failed', e)
  }
}

export async function sendSellerNotification(opts: {
  sellerEmail: string
  horseName: string
  hammerPrice: number
}): Promise<void> {
  console.log('[seller-notify] sold', opts)
}

export async function sendOutbidNotification(opts: {
  bidderEmail: string
  horseName: string
  auctionId: string
}): Promise<void> {
  console.log('[outbid-notify]', opts)
}

export async function sendStatusChangeNotification(opts: {
  emails: string[]
  auctionId: string
  newStatus: string
}): Promise<void> {
  console.log('[status-change-notify]', opts)
}
