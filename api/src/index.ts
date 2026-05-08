import 'dotenv/config'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { initSocket } from './lib/auctionSocket'
import authRouter from './routes/auth'
import maresRouter from './routes/mares'
import stallionsRouter from './routes/stallions'
import pairingsRouter from './routes/pairings'
import horsesRouter from './routes/horses'
import foalsRouter from './routes/foals'
import heatCyclesRouter from './routes/heatCycles'
import billingRouter from './routes/billing'
import settingsRouter from './routes/settings'

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
app.use('/api/billing', billingRouter)
app.use('/api/settings', settingsRouter)

const PORT = parseInt(process.env.PORT ?? '3001')
const httpServer = createServer(app)
initSocket(httpServer)
httpServer.listen(PORT, () => console.log(`EquineIQ API running on :${PORT}`))
