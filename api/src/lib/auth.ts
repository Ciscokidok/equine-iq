import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const ALGORITHM = 'HS256'
const EXPIRES_IN = '7d'

function getSecret(): string {
  const s = process.env.SECRET_KEY
  if (!s) throw new Error('SECRET_KEY env var is not set')
  return s
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export interface TokenPayload {
  sub: string   // user id
  email: string
  tier: string
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), { algorithm: ALGORITHM, expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret(), { algorithms: [ALGORITHM] }) as TokenPayload
}
