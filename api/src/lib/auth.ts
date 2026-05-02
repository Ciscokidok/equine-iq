import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SECRET = process.env.SECRET_KEY
if (!SECRET) throw new Error('SECRET_KEY env var is not set')

const ALGORITHM = 'HS256'
const EXPIRES_IN = '7d'

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
  return jwt.sign(payload, SECRET!, { algorithm: ALGORITHM, expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET!, { algorithms: [ALGORITHM] }) as TokenPayload
}
