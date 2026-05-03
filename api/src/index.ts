import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import maresRouter from './routes/mares'
import stallionsRouter from './routes/stallions'
import pairingsRouter from './routes/pairings'
import horsesRouter from './routes/horses'
import foalsRouter from './routes/foals'
import heatCyclesRouter from './routes/heatCycles'

const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/mares', maresRouter)
app.use('/api/mares/:mareId/heat-cycles', heatCyclesRouter)
app.use('/api/stallions', stallionsRouter)
app.use('/api/pairings', pairingsRouter)
app.use('/api/horses', horsesRouter)
app.use('/api/foals', foalsRouter)

const PORT = parseInt(process.env.PORT ?? '3001')
app.listen(PORT, () => console.log(`EquineIQ API running on :${PORT}`))
