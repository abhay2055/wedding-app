import { prisma } from "../config/prisma";

export async function findMessagesByConversation(conversationId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  // Most-recent-first at the DB level (cheap, indexed), reversed in the
  // service layer so the API returns oldest-first (natural reading order)
  // while pagination still walks backward from the latest message.
  const [items, total] = await prisma.$transaction([
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: { conversationId } }),
  ]);
  return { items, total };
}

export function createMessage(conversationId: string, senderId: string, body: string) {
  return prisma.message.create({ data: { conversationId, senderId, body } });
}

export function markConversationRead(conversationId: string, readerId: string) {
  return prisma.message.updateMany({
    where: { conversationId, senderId: { not: readerId }, isRead: false },
    data: { isRead: true },
  });
}
