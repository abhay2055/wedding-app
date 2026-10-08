import { apiClient } from "./client";
import { Conversation, Message, PaginatedResult } from "../types/api";

export async function listConversations(): Promise<Conversation[]> {
  const res = await apiClient.get("/conversations");
  return res.data.data.conversations;
}

export async function getOrCreateConversation(input: { vendorId?: string; bookingId?: string }): Promise<Conversation> {
  const res = await apiClient.post("/conversations", input);
  return res.data.data.conversation;
}

export async function getConversation(id: string): Promise<Conversation> {
  const res = await apiClient.get(`/conversations/${id}`);
  return res.data.data.conversation;
}

export async function listMessages(conversationId: string, page = 1, limit = 50): Promise<PaginatedResult<Message>> {
  const res = await apiClient.get(`/conversations/${conversationId}/messages`, { params: { page, limit } });
  return res.data.data;
}

export async function sendMessage(conversationId: string, body: string): Promise<Message> {
  const res = await apiClient.post(`/conversations/${conversationId}/messages`, { body });
  return res.data.data.message;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.patch(`/conversations/${conversationId}/read`);
}
