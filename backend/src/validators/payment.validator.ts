import { z } from "zod";

export const bookingIdParamSchema = z.object({
  params: z.object({ bookingId: z.string().uuid("Invalid booking id") }),
});

// Field names match exactly what Razorpay Checkout's handler callback
// hands the frontend (razorpay_order_id/razorpay_payment_id/razorpay_signature),
// just without the "razorpay_" prefix, since this app only ever talks to
// one provider today and the PaymentProvider interface is provider-agnostic.
export const verifyPaymentSchema = z.object({
  body: z.object({
    providerOrderId: z.string().min(1, "providerOrderId is required"),
    providerPaymentId: z.string().min(1, "providerPaymentId is required"),
    providerSignature: z.string().min(1, "providerSignature is required"),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid payment id") }),
});

export const refundPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid payment id") }),
  body: z.object({
    amount: z.coerce.number().int().positive("amount must be a positive whole-rupee value").optional(),
    reason: z.string().trim().max(500).optional(),
  }),
});

const PAYMENT_STATUS_FILTERS = [
  "CREATED",
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export const paymentListQuerySchema = z.object({
  query: z.object({
    status: z.enum(PAYMENT_STATUS_FILTERS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const adminPaymentListQuerySchema = z.object({
  query: z.object({
    status: z.enum(PAYMENT_STATUS_FILTERS).optional(),
    vendorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>["body"];
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>["body"];
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>["query"];
export type AdminPaymentListQuery = z.infer<typeof adminPaymentListQuerySchema>["query"];
