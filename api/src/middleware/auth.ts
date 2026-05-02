import { Request, Response, NextFunction } from 'express'
import { verifyToken, TokenPayload } from '../lib/auth'

export interface AuthRequest extends Request {
  user: TokenPayload
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = header.slice(7)
  try {
    (req as AuthRequest).user = verifyToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function getUserId(req: Request): string {
  return (req as AuthRequest).user.sub
}
