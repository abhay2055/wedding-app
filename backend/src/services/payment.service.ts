import { Booking, Payment, PaymentStatus, PaymentType, Prisma, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { getPaymentProvider } from "../payments";
import * as paymentRepository from "../repositories/payment.repository";
import * as commissionRepository from "../repositories/commission.repository";
import * as webhookEventRepository from "../repositories/webhookEvent.repository";
import * as vendorRepository from "../repositories/vendor.repository";
import * as bookingService from "./booking.service";
import * as commissionService from "./commission.service";
import * as notificationService from "./notification.service";
import { AdminPaymentListQuery, PaymentListQuery, VerifyPaymentInput } from "../validators/payment.validator";

// --- Customer: create/reuse a payment order for a booking's advance ---

export async function createPaymentOrder(customerId: string, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== customerId) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }
  if (booking.status !== "ACCEPTED") {
    throw ApiError.conflict(
      `Payment can only be made for an ACCEPTED booking (current status: ${booking.status})`,
      "PAYMENT_NOT_APPLICABLE",
    );
  }
  if (!booking.advanceAmount || booking.advanceAmount <= 0) {
    throw ApiError.badRequest("No advance payment is required for this booking", "PAYMENT_NOT_REQUIRED");
  }

  // Prevent duplicate active orders: if the customer already has an
  // in-flight (not yet terminal) advance payment for this booking, hand
  // back the same order instead of creating a new one - this is also what
  // makes "customer clicks Pay Advance twice in a row" safe.
  const existing = await paymentRepository.findActivePaymentForBooking(bookingId, PaymentType.ADVANCE);
  if (existing && existing.providerOrderId) {
    return buildOrderResponse(existing, booking.bookingNumber);
  }

  // The amount is never taken from the request body - it's the
  // server-computed value already snapshotted onto the booking at creation
  // time from the package's advancePercentage (see booking.service.createBooking).
  const amount = booking.advanceAmount;

  const payment = await paymentRepository.createPayment({
    bookingId: booking.id,
    customerId: booking.customerId,
    vendorId: booking.vendorId,
    amount,
    currency: "INR",
    paymentType: PaymentType.ADVANCE,
    status: PaymentStatus.CREATED,
  });

  const provider = getPaymentProvider();
  const order = await provider.createOrder({
    amountInRupees: amount,
    currency: "INR",
    receipt: `${booking.bookingNumber}-${payment.id.slice(0, 8)}`,
    notes: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
  });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { providerOrderId: order.providerOrderId, status: PaymentStatus.PENDING },
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: "PENDING" },
  });

  return buildOrderResponse(updated, booking.bookingNumber);
}

function buildOrderResponse(payment: Payment, bookingNumber: string) {
  return {
    paymentId: payment.id,
    providerOrderId: payment.providerOrderId,
    amount: payment.amount,
    currency: payment.currency,
    // Safe to expose - it's the *public* key id, exactly what Razorpay
    // Checkout's client-side script requires. RAZORPAY_KEY_SECRET/
    // RAZORPAY_WEBHOOK_SECRET are never read outside backend/src/payments/.
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    bookingNumber,
  };
}

// --- Customer: verify a completed (or failed) checkout ---

export async function verifyPayment(customerId: string, input: VerifyPaymentInput) {
  const payment = await paymentRepository.findPaymentByProviderOrderId(input.providerOrderId);
  if (!payment || payment.customerId !== customerId) {
    throw ApiError.notFound("Payment not found", "PAYMENT_NOT_FOUND");
  }

  // Idempotent: a payment that's already reached a terminal state is
  // reported as-is, never reprocessed - handles the customer's browser
  // firing the verification call twice, or racing the webhook.
  if (isTerminal(payment.status)) {
    return { payment: toSafePayment(payment) };
  }

  const provider = getPaymentProvider();
  const signatureValid = provider.verifyPaymentSignature({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    providerSignature: input.providerSignature,
  });

  if (!signatureValid) {
    await failPayment(payment.id, payment.bookingId, "Payment signature verification failed");
    throw ApiError.badRequest("Payment verification failed", "PAYMENT_VERIFICATION_FAILED");
  }

  const providerPayment = await provider.fetchPayment(input.providerPaymentId);
  const amountMatches = providerPayment.amountInRupees === payment.amount;
  const isCaptured = providerPayment.status === "captured";

  if (!amountMatches || !isCaptured) {
    await failPayment(
      payment.id,
      payment.bookingId,
      !amountMatches
        ? `Amount mismatch: expected ${payment.amount}, provider reported ${providerPayment.amountInRupees}`
        : `Provider reported payment status "${providerPayment.status}", expected "captured"`,
    );
    throw ApiError.badRequest("Payment verification failed", "PAYMENT_VERIFICATION_FAILED");
  }

  const result = await applyCapture(payment.id, input.providerPaymentId, input.providerSignature, providerPayment.amountInRupees);
  return { payment: toSafePayment(result.payment), booking: result.booking };
}

// --- Webhook (Razorpay server-to-server) ---

export async function processRazorpayWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  const provider = getPaymentProvider();
  if (!signature || !provider.verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.badRequest("Invalid webhook signature", "INVALID_WEBHOOK_SIGNATURE");
  }

  let payload: {
    id?: string;
    event?: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status: string } } };
  };
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw ApiError.badRequest("Malformed webhook payload", "INVALID_WEBHOOK_PAYLOAD");
  }

  const providerEventId = payload.id;
  const eventType = payload.event;
  if (!providerEventId || !eventType) {
    throw ApiError.badRequest("Webhook payload is missing id/event", "INVALID_WEBHOOK_PAYLOAD");
  }

  // The @@unique([provider, providerEventId]) constraint is the actual
  // idempotency guard - a redelivered event's insert collides (P2002),
  // which we catch and treat as "already handled, ack it" without
  // reprocessing any state transition.
  let eventRecord;
  try {
    eventRecord = await webhookEventRepository.recordEvent({
      provider: "RAZORPAY",
      providerEventId,
      eventType,
      payload: payload as unknown as Prisma.InputJsonValue,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return; // Already processed (or in-flight) - ack without reprocessing.
    }
    throw err;
  }

  const entity = payload.payload?.payment?.entity;
  try {
    if ((eventType === "payment.captured" || eventType === "payment.failed") && entity) {
      const payment = await paymentRepository.findPaymentByProviderOrderId(entity.order_id);
      if (payment && !isTerminal(payment.status)) {
        if (eventType === "payment.captured") {
          await applyCapture(payment.id, entity.id, "", Math.round(entity.amount / 100));
        } else {
          await failPayment(payment.id, payment.bookingId, "Razorpay reported payment.failed");
        }
      }
      await webhookEventRepository.markProcessed(eventRecord.id, "PROCESSED");
    } else {
      // Any other event type (order.paid, refund.processed, etc.) is safely
      // acknowledged and ignored for Phase 5 - only capture/failed drive a
      // state transition here.
      await webhookEventRepository.markProcessed(eventRecord.id, "IGNORED");
    }
  } catch (err) {
    await webhookEventRepository.markProcessed(eventRecord.id, "FAILED");
    throw err;
  }
}

// --- Shared outcome application (used by both verifyPayment and the webhook) ---

function isTerminal(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.CAPTURED ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.CANCELLED ||
    status === PaymentStatus.REFUNDED ||
    status === PaymentStatus.PARTIALLY_REFUNDED
  );
}

async function failPayment(paymentId: string, bookingId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction - if something else already
    // captured this payment (e.g. the webhook beat a slow verify call),
    // never downgrade a captured payment to failed.
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (isTerminal(current.status)) return;

    await paymentRepository.createAttempt(tx, {
      paymentId,
      provider: "RAZORPAY",
      amount: current.amount,
      status: PaymentStatus.FAILED,
      errorMessage: reason,
    });
    await paymentRepository.updatePayment(tx, paymentId, { status: PaymentStatus.FAILED, failureReason: reason });
    await bookingService.recordBookingPaymentStatus(tx, bookingId, "FAILED");
  });
  const payment = await paymentRepository.findPaymentByIdRaw(paymentId);
  if (payment) await notificationService.notifyPaymentFailed(payment);
}

async function applyCapture(
  paymentId: string,
  providerPaymentId: string,
  providerSignature: string,
  amountInRupees: number,
): Promise<{ payment: Payment; booking: Booking }> {
  const result = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction, under the row lock the UPDATE below
    // acquires - if the webhook and the verify call raced, whichever
    // commits first wins and the second sees CAPTURED already and no-ops,
    // so a payment (and its commission, and the booking confirmation) can
    // never be applied twice.
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (current.status === PaymentStatus.CAPTURED) {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: current.bookingId } });
      return { payment: current, booking, alreadyApplied: true as const };
    }
    if (isTerminal(current.status)) {
      // Already FAILED/CANCELLED/REFUNDED - a late capture event for a
      // payment we already gave up on. Don't silently resurrect it.
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: current.bookingId } });
      return { payment: current, booking, alreadyApplied: true as const };
    }

    await paymentRepository.createAttempt(tx, {
      paymentId,
      provider: "RAZORPAY",
      providerOrderId: current.providerOrderId,
      providerPaymentId,
      amount: amountInRupees,
      status: PaymentStatus.CAPTURED,
    });

    const captured = await paymentRepository.updatePayment(tx, paymentId, {
      status: PaymentStatus.CAPTURED,
      providerPaymentId,
      providerSignature: providerSignature || undefined,
      paidAt: new Date(),
    });

    const commission = commissionService.calculate(captured.amount);
    await commissionRepository.createCommission(tx, {
      bookingId: captured.bookingId,
      vendorId: captured.vendorId,
      paymentId: captured.id,
      type: "PERCENTAGE",
      percentage: commission.percentage,
      grossAmount: commission.grossAmount,
      commissionAmount: commission.commissionAmount,
      vendorAmount: commission.vendorAmount,
      status: "APPLIED",
    });

    const booking = await bookingService.confirmBookingAfterPayment(tx, captured.bookingId, captured.amount);

    return { payment: captured, booking, alreadyApplied: false as const };
  });

  if (!result.alreadyApplied) {
    await notificationService.notifyPaymentCaptured(result.payment);
    await notificationService.notifyBookingConfirmed(result.booking);
  }
  return result;
}

// --- Reads ---

// Never returned by any response DTO: providerSignature (a verification
// artifact, not something the frontend needs) - see toSafePayment below.
function toSafePayment(payment: Payment) {
  const { providerSignature: _providerSignature, ...safe } = payment;
  return safe;
}

export async function getPayment(userId: string, role: Role, id: string) {
  const payment = await paymentRepository.findPaymentById(id);
  if (!payment) throw ApiError.notFound("Payment not found", "PAYMENT_NOT_FOUND");

  const isOwner = role === Role.CUSTOMER && payment.customerId === userId;
  let isVendorParty = false;
  if (!isOwner && role === Role.VENDOR) {
    const vendor = await vendorRepository.findVendorByUserId(userId);
    isVendorParty = Boolean(vendor && vendor.id === payment.vendorId);
  }
  if (!isOwner && !isVendorParty) {
    throw ApiError.notFound("Payment not found", "PAYMENT_NOT_FOUND");
  }
  return { ...payment, providerSignature: undefined };
}

export async function listMyPayments(customerId: string, query: PaymentListQuery) {
  const { items, total } = await paymentRepository.findPaymentsByCustomer(customerId, query);
  return {
    items: items.map((p) => ({ ...p, providerSignature: undefined })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function listVendorPayments(vendorUserId: string, query: PaymentListQuery) {
  const vendor = await vendorRepository.findVendorByUserId(vendorUserId);
  if (!vendor) throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  const { items, total } = await paymentRepository.findPaymentsByVendor(vendor.id, query);
  return {
    items: items.map((p) => ({ ...p, providerSignature: undefined })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

// --- Admin ---

export async function listPaymentsForAdmin(query: AdminPaymentListQuery) {
  const { items, total } = await paymentRepository.findPaymentsForAdmin(query);
  return {
    items: items.map((p) => ({ ...p, providerSignature: undefined })),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

// --- Admin: refund (full or partial) ---

export async function refundPayment(paymentId: string, amount: number | undefined) {
  const payment = await paymentRepository.findPaymentByIdRaw(paymentId);
  if (!payment) throw ApiError.notFound("Payment not found", "PAYMENT_NOT_FOUND");
  if (payment.status !== PaymentStatus.CAPTURED && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) {
    throw ApiError.conflict("Only a captured payment can be refunded", "PAYMENT_NOT_REFUNDABLE");
  }
  const alreadyRefunded = await prisma.payment.aggregate({
    where: { refundOfPaymentId: paymentId, status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] } },
    _sum: { amount: true },
  });
  const refundedSoFar = alreadyRefunded._sum.amount ?? 0;
  const remaining = payment.amount - refundedSoFar;
  const refundAmount = amount ?? remaining;

  if (refundAmount <= 0 || refundAmount > remaining) {
    throw ApiError.badRequest(
      `Refund amount must be between 1 and ${remaining} (already refunded: ${refundedSoFar})`,
      "INVALID_REFUND_AMOUNT",
    );
  }

  const provider = getPaymentProvider();
  const providerRefund = await provider.refundPayment(payment.providerPaymentId!, refundAmount);

  const isFullRefund = refundedSoFar + refundAmount >= payment.amount;

  const result = await prisma.$transaction(async (tx) => {
    const refundRecord = await tx.payment.create({
      data: {
        bookingId: payment.bookingId,
        customerId: payment.customerId,
        vendorId: payment.vendorId,
        provider: "RAZORPAY",
        providerPaymentId: providerRefund.providerRefundId,
        amount: refundAmount,
        currency: payment.currency,
        status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        paymentType: PaymentType.REFUND,
        refundOfPaymentId: payment.id,
        paidAt: new Date(),
      },
    });

    await paymentRepository.updatePayment(tx, payment.id, {
      status: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
    });

    // BookingPaymentStatus has no PARTIALLY_REFUNDED value (see schema) -
    // only a full refund of the captured amount moves the booking to
    // REFUNDED; a partial refund leaves it PAID, since most of the advance
    // is still captured and the booking itself is still on.
    if (isFullRefund) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { paymentStatus: "REFUNDED" },
      });
    }

    return refundRecord;
  });

  await notificationService.notifyPaymentRefunded(result);

  return { ...result, providerSignature: undefined };
}
