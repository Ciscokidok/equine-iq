import crypto from 'crypto'

const KEY = process.env.ENCRYPTION_KEY ?? ''
const IV_LENGTH = 16

export function encrypt(text: string): string {
  if (!KEY) throw new Error('ENCRYPTION_KEY not set')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(KEY.slice(0, 64), 'hex'), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
  if (!KEY) throw new Error('ENCRYPTION_KEY not set')
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY.slice(0, 64), 'hex'), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
