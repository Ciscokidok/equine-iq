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

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized — call initSocket first')
  return io
}
