import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";
import * as conversationService from "../services/conversation.service";
import * as messageService from "../services/message.service";

// A small, self-contained real-time layer on top of the existing REST
// services - it never duplicates authorization or persistence logic.
// `message:send`/`conversation:read` over the socket call the exact same
// conversationService/messageService functions the REST controllers call,
// so REST remains the single source of truth and stays fully functional
// even for a client that never connects a socket at all (e.g. a first cut
// of the future Swift app).

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    role: Role;
  };
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function initSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  // Authenticated connection: the same short-lived access token used for
  // REST calls, passed via the socket handshake rather than a header.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Authentication required"));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data = { userId: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const authed = socket as AuthedSocket;

    socket.on("conversation:join", async (conversationId: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        if (typeof conversationId !== "string") throw new Error("Invalid conversation id");
        // Never trust the client - re-verify participation on every join,
        // exactly like the REST GET /conversations/:id does.
        await conversationService.requireParticipant(conversationId, authed.data.userId, authed.data.role);
        socket.join(conversationRoom(conversationId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : "Could not join conversation" });
      }
    });

    socket.on("conversation:leave", (conversationId: unknown) => {
      if (typeof conversationId === "string") socket.leave(conversationRoom(conversationId));
    });

    socket.on(
      "message:send",
      async (
        payload: unknown,
        ack?: (res: { ok: boolean; message?: unknown; error?: string }) => void,
      ) => {
        try {
          const { conversationId, body } = (payload ?? {}) as { conversationId?: unknown; body?: unknown };
          if (typeof conversationId !== "string" || typeof body !== "string" || body.trim().length === 0) {
            throw new Error("conversationId and a non-empty body are required");
          }
          const message = await messageService.sendMessage(authed.data.userId, authed.data.role, conversationId, {
            body,
          });
          io.to(conversationRoom(conversationId)).emit("message:new", message);
          ack?.({ ok: true, message });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : "Could not send message" });
        }
      },
    );

    socket.on("conversation:read", async (conversationId: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        if (typeof conversationId !== "string") throw new Error("Invalid conversation id");
        await messageService.markConversationRead(authed.data.userId, authed.data.role, conversationId);
        io.to(conversationRoom(conversationId)).emit("message:read", { conversationId, readerId: authed.data.userId });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : "Could not mark conversation read" });
      }
    });

    // No explicit cleanup needed on "disconnect" - Socket.IO removes the
    // socket from every room automatically, and reconnecting clients just
    // re-authenticate and re-join whatever conversation they had open.
  });

  return io;
}
