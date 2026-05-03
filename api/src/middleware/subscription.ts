import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { getUserId } from './auth'

const PLAN_RANK: Record<string, number> = { free: 0, breeder: 1, professional: 2, enterprise: 3 }

export function requirePlan(minPlan: 'breeder' | 'professional' | 'enterprise') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, subscriptionStatus: true },
      })
      if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }

      const isPaid = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing'
      const hasRank = (PLAN_RANK[user.plan] ?? 0) >= (PLAN_RANK[minPlan] ?? 99)

      if (!hasRank || !isPaid) {
        res.status(403).json({
          error: `This feature requires the ${minPlan} plan or higher`,
          requiredPlan: minPlan,
          currentPlan: user.plan,
        })
        return
      }
      next()
    } catch (e) {
      res.status(401).json({ error: 'Unauthorized' })
    }
  }
}
