import { Booking, Conversation, Message, Payment, Review, Vendor } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import * as notificationRepository from "../repositories/notification.repository";
import { NotificationListQuery } from "../validators/notification.validator";

// The single write path for every in-app notification in this app - no
// controller ever calls notificationRepository directly (see the Phase 6
// spec's "business services call the notification service" rule). Booking/
// payment/message/review/vendor-admin services call the named functions
// below; this stays a thin, named-hook-point layer the same way Phase 4/5
// left it, just backed by a real persisted Notification now instead of a
// console.debug no-op.
function create(
  userId: string,
  type: Parameters<typeof notificationRepository.createNotification>[0]["type"],
  title: string,
  message: string,
  entityType?: string,
  entityId?: string,
) {
  return notificationRepository.createNotification({ userId, type, title, message, entityType, entityId });
}

// Booking.vendorId/Payment.vendorId/Review.vendorId are all Vendor.id, not
// a User.id - every vendor-facing notification needs this one extra lookup
// to find who actually logs in for that vendor account. Resolving it here
// (rather than requiring every call site to pre-fetch and pass it) keeps
// booking/payment/review services free of notification-plumbing concerns.
async function vendorUserId(vendorId: string): Promise<string | null> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { userId: true } });
  return vendor?.userId ?? null;
}

// --- Bookings ---

export async function notifyBookingCreated(booking: Booking & { vendor?: { userId: string } }): Promise<void> {
  const uid = booking.vendor?.userId ?? (await vendorUserId(booking.vendorId));
  if (!uid) return;
  await create(
    uid,
    "BOOKING_CREATED",
    "New booking request",
    `You have a new booking request (${booking.bookingNumber}).`,
    "booking",
    booking.id,
  );
}

export async function notifyBookingAccepted(booking: Booking): Promise<void> {
  await create(
    booking.customerId,
    "BOOKING_ACCEPTED",
    "Booking accepted",
    `Your booking ${booking.bookingNumber} has been accepted.`,
    "booking",
    booking.id,
  );
}

export async function notifyBookingDeclined(booking: Booking): Promise<void> {
  await create(
    booking.customerId,
    "BOOKING_DECLINED",
    "Booking declined",
    `Your booking request ${booking.bookingNumber} was declined.`,
    "booking",
    booking.id,
  );
}

// `cancelledByUserId` is whichever party (customer or vendor) actually
// cancelled - only the *other* party is notified, never the actor.
export async function notifyBookingCancelled(booking: Booking, cancelledByUserId: string): Promise<void> {
  const recipientId =
    cancelledByUserId === booking.customerId ? await vendorUserId(booking.vendorId) : booking.customerId;
  if (!recipientId) return;
  await create(
    recipientId,
    "BOOKING_CANCELLED",
    "Booking cancelled",
    `Booking ${booking.bookingNumber} was cancelled.`,
    "booking",
    booking.id,
  );
}

export async function notifyBookingConfirmed(booking: Booking): Promise<void> {
  await create(
    booking.customerId,
    "BOOKING_CONFIRMED",
    "Booking confirmed",
    `Your booking ${booking.bookingNumber} is confirmed - advance payment received.`,
    "booking",
    booking.id,
  );
  const vId = await vendorUserId(booking.vendorId);
  if (vId) {
    await create(
      vId,
      "BOOKING_CONFIRMED",
      "Advance payment received",
      `Booking ${booking.bookingNumber} is confirmed - the advance has been paid.`,
      "booking",
      booking.id,
    );
  }
}

export async function notifyBookingCompleted(booking: Booking): Promise<void> {
  await create(
    booking.customerId,
    "BOOKING_COMPLETED",
    "Booking completed",
    `Your booking ${booking.bookingNumber} is marked completed. You can now leave a review.`,
    "booking",
    booking.id,
  );
}

// --- Payments ---

export async function notifyPaymentCaptured(payment: Payment): Promise<void> {
  await create(
    payment.customerId,
    "PAYMENT_SUCCESS",
    "Payment successful",
    `Your advance payment of ₹${payment.amount} was successful.`,
    "payment",
    payment.id,
  );
  const vId = await vendorUserId(payment.vendorId);
  if (vId) {
    await create(
      vId,
      "PAYMENT_SUCCESS",
      "Advance payment received",
      `An advance payment of ₹${payment.amount} was received for booking ${payment.bookingId}.`,
      "payment",
      payment.id,
    );
  }
}

export async function notifyPaymentFailed(payment: Payment): Promise<void> {
  await create(
    payment.customerId,
    "PAYMENT_FAILED",
    "Payment failed",
    `Your payment of ₹${payment.amount} could not be completed. ${payment.failureReason ?? ""}`.trim(),
    "payment",
    payment.id,
  );
}

export async function notifyPaymentRefunded(payment: Payment): Promise<void> {
  await create(
    payment.customerId,
    "PAYMENT_REFUNDED",
    "Payment refunded",
    `₹${payment.amount} was refunded to you.`,
    "payment",
    payment.id,
  );
}

// --- Messages ---

// `sender` is whichever role actually sent it - the recipient is always
// the *other* participant, never the sender.
export async function notifyNewMessage(message: Message, conversation: Conversation & {
  customer: { name: string };
  vendor: { businessName: string; userId: string };
}): Promise<void> {
  const senderIsCustomer = message.senderId === conversation.customerId;
  const recipientId = senderIsCustomer ? conversation.vendor.userId : conversation.customerId;
  const senderLabel = senderIsCustomer ? conversation.customer.name : conversation.vendor.businessName;
  await create(
    recipientId,
    "NEW_MESSAGE",
    "New message",
    `New message from ${senderLabel}.`,
    "conversation",
    conversation.id,
  );
}

// --- Reviews ---

export async function notifyReviewReceived(review: Review): Promise<void> {
  const vId = await vendorUserId(review.vendorId);
  if (!vId) return;
  await create(vId, "REVIEW_RECEIVED", "New review received", `You received a new ${review.rating}-star review.`, "review", review.id);
}

export async function notifyReviewPublished(review: Review): Promise<void> {
  await create(review.customerId, "REVIEW_PUBLISHED", "Review published", "Your review is now live on the vendor's profile.", "review", review.id);
}

export async function notifyReviewRejected(review: Review): Promise<void> {
  await create(review.customerId, "REVIEW_REJECTED", "Review rejected", "Your review was not approved for publication.", "review", review.id);
}

// --- Vendor admin actions ---

export async function notifyVendorVerified(vendor: Vendor): Promise<void> {
  await create(vendor.userId, "VENDOR_VERIFIED", "Vendor verified", "Your vendor profile has been verified.", "vendor", vendor.id);
}

export async function notifyVendorRejected(vendor: Vendor): Promise<void> {
  await create(vendor.userId, "VENDOR_REJECTED", "Vendor profile requires changes", "Your vendor profile requires changes before it can be verified.", "vendor", vendor.id);
}

export async function notifyVendorActivated(vendor: Vendor): Promise<void> {
  await create(vendor.userId, "VENDOR_ACTIVATED", "Vendor account activated", "Your vendor account has been activated.", "vendor", vendor.id);
}

export async function notifyVendorDeactivated(vendor: Vendor): Promise<void> {
  await create(vendor.userId, "VENDOR_DEACTIVATED", "Vendor account deactivated", "Your vendor account has been deactivated.", "vendor", vendor.id);
}

// --- Notification center API (used by controllers/notification.controller.ts) ---

export async function listMyNotifications(userId: string, query: NotificationListQuery) {
  const { items, total } = await notificationRepository.findNotificationsForUser(userId, {
    unreadOnly: query.unreadOnly,
    page: query.page,
    limit: query.limit,
  });
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export function getUnreadCount(userId: string): Promise<number> {
  return notificationRepository.countUnread(userId);
}

async function requireOwnNotification(userId: string, id: string) {
  const notification = await notificationRepository.findNotificationById(id);
  // 404, not 403 - same IDOR pattern as every other owned resource in this app.
  if (!notification || notification.userId !== userId) {
    throw ApiError.notFound("Notification not found", "NOTIFICATION_NOT_FOUND");
  }
  return notification;
}

export async function markRead(userId: string, id: string) {
  await requireOwnNotification(userId, id);
  return notificationRepository.markRead(id);
}

export async function markAllRead(userId: string): Promise<void> {
  await notificationRepository.markAllRead(userId);
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  await requireOwnNotification(userId, id);
  await notificationRepository.deleteNotification(id);
}
