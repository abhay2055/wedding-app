import { useEffect } from "react";
import { connectSocket, joinConversation, leaveConversation } from "../realtime/socket";
import { Message } from "../types/api";

interface UseConversationSocketOptions {
  onNewMessage: (message: Message) => void;
  onRead: (readerId: string) => void;
}

// Joins the conversation's room for real-time updates while a thread is
// open; does nothing if the socket can't connect (chat still works via
// REST - see realtime/socket.ts). Failing silently here is deliberate: a
// missed real-time update is a UX nicety lost, not a broken feature.
export function useConversationSocket(conversationId: string | undefined, { onNewMessage, onRead }: UseConversationSocketOptions) {
  useEffect(() => {
    if (!conversationId) return;

    const socket = connectSocket();
    joinConversation(conversationId).catch(() => undefined);

    function handleNewMessage(message: Message) {
      if (message.conversationId === conversationId) onNewMessage(message);
    }
    function handleRead(payload: { conversationId: string; readerId: string }) {
      if (payload.conversationId === conversationId) onRead(payload.readerId);
    }

    socket.on("message:new", handleNewMessage);
    socket.on("message:read", handleRead);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:read", handleRead);
      leaveConversation(conversationId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
}
