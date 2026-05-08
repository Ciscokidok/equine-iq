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
  if (isTest()) { console.log('[outbid-notify]', opts); return }
  try {
    await sgMail.send({
      to: opts.bidderEmail,
      from: FROM,
      subject: `You've been outbid on ${opts.horseName}`,
      text: `You've been outbid. View auction: /auctions/${opts.auctionId}`,
    })
  } catch (e) { console.error('[outbid-notify] sendgrid failed', e) }
}

export async function sendStatusChangeNotification(opts: {
  emails: string[]
  auctionId: string
  newStatus: string
}): Promise<void> {
  if (isTest()) { console.log('[status-change-notify]', opts); return }
  for (const email of opts.emails) {
    try {
      await sgMail.send({
        to: email,
        from: FROM,
        subject: `Auction update: now ${opts.newStatus}`,
        text: `Auction ${opts.auctionId} is now ${opts.newStatus}.`,
      })
    } catch (e) { console.error('[status-change-notify] sendgrid failed for', email, e) }
  }
}
