import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../api/client";

// REST stays the source of truth: sending a message and marking a
// conversation read both always go through the REST API
// (api/conversations.ts), so chat works even if the socket never connects.
// This module only exists to receive the real-time "message:new" /
// "message:read" events the server broadcasts to a conversation's room -
// see backend/src/realtime/socket.ts.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";
const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false, withCredentials: true });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  // Re-read the token on every connect attempt in case it changed (login,
  // silent refresh) since the socket instance was first created.
  s.auth = { token: getAccessToken() };
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function joinConversation(conversationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    connectSocket().emit("conversation:join", conversationId, (ack: { ok: boolean; error?: string }) => {
      if (ack?.ok) resolve();
      else reject(new Error(ack?.error ?? "Could not join conversation"));
    });
  });
}

export function leaveConversation(conversationId: string): void {
  socket?.emit("conversation:leave", conversationId);
}
