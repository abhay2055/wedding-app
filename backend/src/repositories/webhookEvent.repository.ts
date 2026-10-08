import { Prisma, WebhookProcessStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

// The @@unique([provider, providerEventId]) constraint on
// PaymentWebhookEvent is what actually enforces idempotency: this insert
// throws Prisma's P2002 for a redelivered event, which the caller catches
// and treats as "already processed, return success" - see
// payment.service.processRazorpayWebhook.
export function recordEvent(data: Prisma.PaymentWebhookEventUncheckedCreateInput) {
  return prisma.paymentWebhookEvent.create({ data });
}

export function markProcessed(id: string, status: WebhookProcessStatus) {
  return prisma.paymentWebhookEvent.update({ where: { id }, data: { status, processedAt: new Date() } });
}
