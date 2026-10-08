import { Role } from "@prisma/client";
import * as conversationService from "./conversation.service";
import * as conversationRepository from "../repositories/conversation.repository";
import * as messageRepository from "../repositories/message.repository";
import * as notificationService from "./notification.service";
import { sanitizePlainText } from "../utils/sanitize";
import { SendMessageInput } from "../validators/conversation.validator";

export async function listMessages(userId: string, role: Role, conversationId: string, page: number, limit: number) {
  await conversationService.requireParticipant(conversationId, userId, role);
  const { items, total } = await messageRepository.findMessagesByConversation(conversationId, page, limit);
  return {
    // Fetched newest-first (cheap, indexed); reversed here so the API
    // returns oldest-first, natural reading order for a chat thread.
    items: items.reverse(),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function sendMessage(userId: string, role: Role, conversationId: string, input: SendMessageInput) {
  const conversation = await conversationService.requireParticipant(conversationId, userId, role);
  const message = await messageRepository.createMessage(conversationId, userId, sanitizePlainText(input.body));
  await conversationRepository.touchConversation(conversationId);
  await notificationService.notifyNewMessage(message, conversation);
  return message;
}

export async function markConversationRead(userId: string, role: Role, conversationId: string): Promise<void> {
  await conversationService.requireParticipant(conversationId, userId, role);
  await messageRepository.markConversationRead(conversationId, userId);
}
