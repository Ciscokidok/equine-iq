import { Server, Socket } from 'socket.io'
import { IncomingMessage, Server as HttpServer } from 'http'
import { verifyToken } from './auth'

let io: Server | null = null

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: true },
  })

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      next(new Error('Unauthorized'))
      return
    }
    try {
      const user = verifyToken(token)
      socket.data.user = user
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { sub: string } | undefined
    if (user?.sub) socket.join(`user:${user.sub}`)

    socket.on('join-auction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`)
    })

    socket.on('leave-auction', (auctionId: string) => {
      socket.leave(`auction:${auctionId}`)
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized — call initSocket first')
  return io
}

export function broadcastBidUpdate(auctionId: string, payload: { currentBid: number; timeRemainingSeconds: number }): void {
  try { getIO().to(`auction:${auctionId}`).emit('bid', payload) } catch (e) { console.error('[socket] broadcastBidUpdate failed', e) }
}

export function broadcastStatusChange(auctionId: string, status: string): void {
  try { getIO().to(`auction:${auctionId}`).emit('status', { status }) } catch (e) { console.error('[socket] broadcastStatusChange failed', e) }
}
