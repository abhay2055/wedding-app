import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as conversationsApi from "../api/conversations";
import { Conversation, Message } from "../types/api";
import { useAuth } from "../context/AuthContext";
import { useConversationSocket } from "../hooks/useConversationSocket";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage, extractErrorMessage } from "../components/ErrorMessage";
import { Button } from "../components/Button";
import { formatDate } from "../utils/format";

function otherPartyName(conversation: Conversation, myRole: string): string {
  return myRole === "VENDOR" ? conversation.customer.name : conversation.vendor.businessName;
}

function ConversationListItem({ conversation, active, basePath, myRole }: { conversation: Conversation; active: boolean; basePath: string; myRole: string }) {
  const unread = conversation._count?.messages ?? 0;
  return (
    <Link
      to={`${basePath}/${conversation.id}`}
      className={`flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 hover:bg-neutral-50 ${active ? "bg-brand-50" : ""}`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-900">{otherPartyName(conversation, myRole)}</p>
        {conversation.booking && <p className="truncate text-xs text-neutral-500">{conversation.booking.bookingNumber}</p>}
      </div>
      {unread > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-medium text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}

function ConversationThread({ conversationId, basePath }: { conversationId: string; basePath: string }) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([conversationsApi.getConversation(conversationId), conversationsApi.listMessages(conversationId, 1, 50)])
      .then(([conv, msgs]) => {
        setConversation(conv);
        setMessages(msgs.items);
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setIsLoading(false));
    conversationsApi.markConversationRead(conversationId).catch(() => undefined);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useConversationSocket(conversationId, {
    onNewMessage: (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      if (message.senderId !== user?.id) {
        conversationsApi.markConversationRead(conversationId).catch(() => undefined);
      }
    },
    onRead: () => undefined,
  });

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setIsSending(true);
    setSendError(null);
    try {
      const message = await conversationsApi.sendMessage(conversationId, body);
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch (err) {
      setSendError(extractErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading conversation..." />;
  if (error || !conversation) return <div className="p-4"><ErrorMessage message={error ?? "Conversation not found"} /></div>;

  const myRole = user?.role ?? "CUSTOMER";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <p className="font-semibold text-neutral-900">{otherPartyName(conversation, myRole)}</p>
          {conversation.booking && (
            <Link
              to={myRole === "VENDOR" ? `/vendor/bookings/${conversation.booking.id}` : `/dashboard/bookings/${conversation.booking.id}`}
              className="text-xs text-brand-700 hover:underline"
            >
              {conversation.booking.bookingNumber}
            </Link>
          )}
        </div>
        <Link to={basePath} className="text-sm text-neutral-500 hover:text-neutral-700 md:hidden">
          ← Back
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-sm text-neutral-500">No messages yet. Say hello!</p>}
        {messages.map((message) => {
          const isMine = message.senderId === user?.id;
          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isMine ? "bg-brand-600 text-white" : "bg-neutral-100 text-neutral-900"}`}>
                <p className="whitespace-pre-line">{message.body}</p>
                <p className={`mt-1 text-[10px] ${isMine ? "text-brand-100" : "text-neutral-400"}`}>{formatDate(message.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-neutral-200 p-3">
        {sendError && <div className="mb-2"><ErrorMessage message={sendError} /></div>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={!draft.trim()} isLoading={isSending}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

export function MessagesPage({ basePath }: { basePath: string }) {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    conversationsApi
      .listConversations()
      .then(setConversations)
      .catch((err) => setError(extractErrorMessage(err)));
  }

  useEffect(load, []);

  // Refresh the unread badge in the list whenever a thread is opened/read.
  useEffect(() => {
    if (conversationId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  if (conversations === null) return <LoadingState label="Loading messages..." />;
  if (error) return <div className="mx-auto max-w-4xl px-4 py-8"><ErrorMessage message={error} /></div>;

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-5xl flex-col px-0 sm:h-[70vh] sm:px-4 sm:py-8">
      <h1 className="hidden px-4 pb-4 text-2xl font-semibold text-brand-800 sm:block">Messages</h1>
      <div className="flex flex-1 overflow-hidden rounded-none border-0 border-neutral-200 bg-white sm:rounded-lg sm:border">
        <div className={`w-full flex-shrink-0 overflow-y-auto border-r border-neutral-200 md:w-72 ${conversationId ? "hidden md:block" : ""}`}>
          {conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No conversations yet." description="Message a vendor from their profile or a booking to start one." />
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationListItem key={c.id} conversation={c} active={c.id === conversationId} basePath={basePath} myRole={user?.role ?? "CUSTOMER"} />
            ))
          )}
        </div>
        <div className={`flex-1 ${conversationId ? "" : "hidden md:block"}`}>
          {conversationId ? (
            <ConversationThread conversationId={conversationId} basePath={basePath} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
