import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import { config } from "../config";
import { Role } from "@prisma/client";

let io: SocketIOServer | null = null;

interface AuthSocket extends Socket {
  userId?: string;
  role?: Role;
  fractionId?: string | null;
}

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
  });

  io.on("connection", (socket: AuthSocket) => {
    const handshakeToken = (socket.handshake.auth?.token as string | undefined) || (socket.handshake.query?.token as string | undefined);
    if (handshakeToken) tryAuthenticate(socket, handshakeToken);

    socket.on("authenticate", (token: string) => {
      tryAuthenticate(socket, token);
    });

    socket.on("join:role", (role: Role) => {
      if (!socket.role) return;
      if (socket.role === role) socket.join(`role:${role}`);
    });

    // Aceita tanto join:fraction como join:unit (legacy) para compatibilidade
    const joinFraction = (fractionId: string) => {
      if (!socket.userId) return;
      if (socket.role === "RESIDENT" && socket.fractionId !== fractionId) return;
      socket.join(`fraction:${fractionId}`);
    };
    socket.on("join:fraction", joinFraction);
    socket.on("join:unit", joinFraction);

    socket.on("disconnect", () => {
      // no-op
    });
  });

  return io;
}

function tryAuthenticate(socket: AuthSocket, token: string) {
  try {
    const payload = verifyAccessToken(token);
    socket.userId = payload.sub;
    socket.role = payload.role;
    socket.fractionId = payload.fractionId ?? null;
    socket.join(`user:${payload.sub}`);
    socket.join(`role:${payload.role}`);
    if (payload.fractionId) socket.join(`fraction:${payload.fractionId}`);
    socket.emit("authenticated", { ok: true, role: payload.role });
  } catch {
    socket.emit("authenticated", { ok: false, error: "Invalid token" });
  }
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export const emitToRole = (role: Role, event: string, payload: unknown) => {
  getIO().to(`role:${role}`).emit(event, payload);
};
export const emitToUser = (userId: string, event: string, payload: unknown) => {
  getIO().to(`user:${userId}`).emit(event, payload);
};
export const emitToFraction = (fractionId: string, event: string, payload: unknown) => {
  getIO().to(`fraction:${fractionId}`).emit(event, payload);
};
