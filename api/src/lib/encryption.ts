import crypto from 'crypto'

const KEY = process.env.ENCRYPTION_KEY ?? ''
const IV_LENGTH = 16

function keyBuffer(): Buffer {
  if (!KEY) throw new Error('ENCRYPTION_KEY not set')
  // Accept both hex (64 chars) and base64 (44 chars) encoded 32-byte keys
  const encoding = KEY.length === 64 && /^[0-9a-fA-F]+$/.test(KEY) ? 'hex' : 'base64'
  return Buffer.from(KEY, encoding)
}

export function encrypt(text: string): string {
  const key = keyBuffer()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
  const key = keyBuffer()
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift()!, 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
