import 'dotenv/config'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { initSocket } from './lib/auctionSocket'
import { registerAdapter, initRegistry } from './lib/adapters/registry'
import { BidpathAdapter } from './lib/adapters/BidpathAdapter'
import authRouter from './routes/auth'
import auctionsRouter from './routes/auctions'
import listingsRouter from './routes/listings'
import cronRouter from './routes/cron'
import vettingRouter from './routes/admin/vetting'
import biddersRouter from './routes/admin/bidders'
import adaptersRouter from './routes/admin/adapters'
import maresRouter from './routes/mares'
import stallionsRouter from './routes/stallions'
import pairingsRouter from './routes/pairings'
import horsesRouter from './routes/horses'
import foalsRouter from './routes/foals'
import heatCyclesRouter from './routes/heatCycles'
import billingRouter from './routes/billing'
import settingsRouter from './routes/settings'
import importRouter from './routes/import'
import platformProvidersRouter from './routes/admin/platformProviders'
import studBookingsRouter from './routes/studBookings'
import foalPipelineRouter from './routes/admin/foalPipeline'
import keenelandSyncRouter from './routes/admin/keenelandSync'
import usersAdminRouter from './routes/admin/users'
import analyticsRouter from './routes/analytics'

const app = express()

app.use(cors({ origin: true }))

// Stripe webhook must use raw body BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/mares', maresRouter)
app.use('/api/mares/:mareId/heat-cycles', heatCyclesRouter)
app.use('/api/stallions', stallionsRouter)
app.use('/api/pairings', pairingsRouter)
app.use('/api/horses', horsesRouter)
app.use('/api/foals', foalsRouter)
app.use('/api/stud-bookings', studBookingsRouter)
app.use('/api/billing', billingRouter)
app.use('/api/settings', settingsRouter)

const PORT = parseInt(process.env.PORT ?? '3001')
const httpServer = createServer(app)
initSocket(httpServer)
registerAdapter('bidpath', new BidpathAdapter())
initRegistry().catch(e => console.error('[startup] initRegistry failed', e))

app.use('/api/auctions', auctionsRouter)
app.use('/api/listings', listingsRouter)
app.use('/api/admin/cron', cronRouter)
app.use('/api/admin/vetting', vettingRouter)
app.use('/api/admin/bidders', biddersRouter)
app.use('/api/admin/adapters', adaptersRouter)
app.use('/api/import', importRouter)
app.use('/api/admin/platform-providers', platformProvidersRouter)
app.use('/api/admin/foal-pipeline', foalPipelineRouter)
app.use('/api/admin/keeneland', keenelandSyncRouter)
app.use('/api/admin/users', usersAdminRouter)
app.use('/api/analytics', analyticsRouter)

httpServer.listen(PORT, () => console.log(`EquineIQ API running on :${PORT}`))

export { app }
