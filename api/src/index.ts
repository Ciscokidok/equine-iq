import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import maresRouter from './routes/mares'
import stallionsRouter from './routes/stallions'
import pairingsRouter from './routes/pairings'
import horsesRouter from './routes/horses'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/mares', maresRouter)
app.use('/api/stallions', stallionsRouter)
app.use('/api/pairings', pairingsRouter)
app.use('/api/horses', horsesRouter)

const PORT = parseInt(process.env.PORT ?? '3001')
app.listen(PORT, () => console.log(`EquineIQ API running on :${PORT}`))
