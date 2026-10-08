import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

const conversationInclude = {
  customer: { select: { id: true, name: true } },
  vendor: { select: { id: true, businessName: true, slug: true, userId: true } },
  booking: { select: { id: true, bookingNumber: true, status: true } },
} satisfies Prisma.ConversationInclude;

export function findConversationById(id: string) {
  return prisma.conversation.findUnique({ where: { id }, include: conversationInclude });
}

export function findConversationByCustomerAndVendor(customerId: string, vendorId: string) {
  return prisma.conversation.findUnique({
    where: { customerId_vendorId: { customerId, vendorId } },
    include: conversationInclude,
  });
}

export function createConversation(customerId: string, vendorId: string, bookingId?: string) {
  return prisma.conversation.create({
    data: { customerId, vendorId, bookingId },
    include: conversationInclude,
  });
}

export function attachBookingIfUnset(conversationId: string, bookingId: string) {
  return prisma.conversation.updateMany({
    where: { id: conversationId, bookingId: null },
    data: { bookingId },
  });
}

// One query, no N+1: unreadCount is a correlated-subquery count per row
// (messages in this conversation, not sent by `userId`, not yet read).
function listInclude(userId: string) {
  return {
    ...conversationInclude,
    _count: {
      select: {
        messages: { where: { isRead: false, senderId: { not: userId } } },
      },
    },
  } satisfies Prisma.ConversationInclude;
}

export function findConversationsForCustomer(customerId: string) {
  return prisma.conversation.findMany({
    where: { customerId },
    orderBy: { updatedAt: "desc" },
    include: listInclude(customerId),
  });
}

export function findConversationsForVendor(vendorUserId: string, vendorId: string) {
  return prisma.conversation.findMany({
    where: { vendorId },
    orderBy: { updatedAt: "desc" },
    include: listInclude(vendorUserId),
  });
}

export function touchConversation(id: string) {
  return prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
}
