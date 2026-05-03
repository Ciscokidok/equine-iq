import sgMail from '@sendgrid/mail'

const apiKey = process.env.SENDGRID_API_KEY
const fromEmail = process.env.FROM_EMAIL || 'no-reply@equineiq.com'

if (apiKey) sgMail.setApiKey(apiKey)

export async function sendEmail(to: string, subject: string, html: string) {
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not set; skipping email send')
    return
  }
  await sgMail.send({ to, from: fromEmail, subject, html })
}
