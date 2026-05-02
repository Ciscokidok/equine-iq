import { clerkMiddleware, getAuth } from '@clerk/express'
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

export const clerk = clerkMiddleware()

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // Upsert user on first request after login
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: (req as any).auth?.sessionClaims?.email ?? '',
    },
  })

  next()
}

export function getUserId(req: Request): string {
  const { userId } = getAuth(req)
  if (!userId) throw new Error('No userId on authenticated request')
  return userId
}
