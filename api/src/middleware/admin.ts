import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from './auth'

interface UserWithRole {
  role?: string
  [key: string]: unknown
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthRequest).user as unknown as UserWithRole
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken || !header?.startsWith('Bearer ') || header.slice(7) !== adminToken) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
