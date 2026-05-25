import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { tokenStore } from "@/lib/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }
    const token = tokenStore.getAccess();
    const s = io(SOCKET_URL || undefined, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on("connect", () => {
      s.emit("authenticate", tokenStore.getAccess());
      s.emit("join:role", user.role);
      if (user.fractionId) s.emit("join:fraction", user.fractionId);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user?.id, user?.role, user?.fractionId]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Subscribe to a socket event with auto-cleanup. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const h = (p: T) => handler(p);
    socket.on(event, h);
    return () => {
      socket.off(event, h);
    };
  }, [socket, event, handler]);
}
