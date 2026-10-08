import { randomUUID } from "crypto";
import { env } from "../config/env";
import { computeHmacSignature, timingSafeEqualHex } from "./signature";
import {
  CreateOrderParams,
  CreateOrderResult,
  FetchPaymentResult,
  PaymentProvider,
  RefundResult,
  VerifyPaymentSignatureParams,
} from "./types";

// Selected automatically instead of RazorpayPaymentProvider whenever
// RAZORPAY_KEY_ID is still the development sentinel (see
// backend/src/config/env.ts's isStubPaymentProvider and
// backend/src/payments/index.ts) - i.e. never in production, and never
// once real credentials are configured. It exists so a fresh clone of this
// repo can exercise the *entire* payment flow - order creation, checkout,
// backend signature verification, amount matching, webhook processing,
// idempotency - with zero network access and zero real credentials.
//
// The one thing it does NOT prove is that this code talks correctly to the
// real Razorpay API (createOrder/fetchPayment/refundPayment are simulated
// in-memory here, not real HTTP calls) - only real `rzp_test_...`
// credentials against RazorpayPaymentProvider can prove that. Everything
// downstream of order creation - signature verification, amount checks,
// webhook idempotency, the booking/commission state transitions - runs
// through the exact same code either way, because it's the exact same
// HMAC math (see signature.ts) and the exact same payment.service.ts.
interface StubOrderRecord {
  amountInRupees: number;
  currency: string;
}
interface StubPaymentRecord {
  orderId: string;
  amountInRupees: number;
  currency: string;
  status: string;
  method: string;
}

const orders = new Map<string, StubOrderRecord>();
const payments = new Map<string, StubPaymentRecord>();

export class StubPaymentProvider implements PaymentProvider {
  readonly name = "RAZORPAY" as const;

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const providerOrderId = `order_stub_${randomUUID().replace(/-/g, "")}`;
    orders.set(providerOrderId, { amountInRupees: params.amountInRupees, currency: params.currency });
    return { providerOrderId, amountInRupees: params.amountInRupees, currency: params.currency };
  }

  verifyPaymentSignature(params: VerifyPaymentSignatureParams): boolean {
    const expected = computeHmacSignature(
      env.RAZORPAY_KEY_SECRET,
      `${params.providerOrderId}|${params.providerPaymentId}`,
    );
    return timingSafeEqualHex(expected, params.providerSignature);
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    const expected = computeHmacSignature(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
    return timingSafeEqualHex(expected, signature);
  }

  async fetchPayment(providerPaymentId: string): Promise<FetchPaymentResult> {
    const record = payments.get(providerPaymentId);
    if (!record) {
      throw new Error(`Stub payment provider: unknown payment id ${providerPaymentId}`);
    }
    return {
      providerPaymentId,
      providerOrderId: record.orderId,
      status: record.status,
      amountInRupees: record.amountInRupees,
      currency: record.currency,
      method: record.method,
    };
  }

  async refundPayment(providerPaymentId: string, amountInRupees?: number): Promise<RefundResult> {
    const record = payments.get(providerPaymentId);
    if (!record) {
      throw new Error(`Stub payment provider: unknown payment id ${providerPaymentId}`);
    }
    const refundAmount = amountInRupees ?? record.amountInRupees;
    return { providerRefundId: `rfnd_stub_${randomUUID().replace(/-/g, "")}`, status: "processed", amountInRupees: refundAmount };
  }
}

// --- Dev/test-only simulation helpers below ---
// Deliberately NOT part of the PaymentProvider interface, so they can never
// be reached through the real Razorpay provider or called by accident in
// production. Used by tests (imported directly) and by a stub-only debug
// route (backend/src/routes/payment.routes.ts) for manual/Playwright
// verification.

export interface SimulatedCheckoutResult {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

// Simulates what Razorpay Checkout would hand back to the frontend after a
// successful (or failed) test payment - a real payment id and a signature
// computed with the real HMAC algorithm, so the normal /payments/verify
// code path can genuinely verify it instead of a bypass.
export function simulateCheckoutCompletion(
  providerOrderId: string,
  outcome: "success" | "failure" = "success",
): SimulatedCheckoutResult {
  const order = orders.get(providerOrderId);
  if (!order) {
    throw new Error(`Stub payment provider: unknown order id ${providerOrderId}`);
  }
  const providerPaymentId = `pay_stub_${randomUUID().replace(/-/g, "")}`;
  payments.set(providerPaymentId, {
    orderId: providerOrderId,
    amountInRupees: order.amountInRupees,
    currency: order.currency,
    status: outcome === "success" ? "captured" : "failed",
    method: "card",
  });

  const providerSignature =
    outcome === "success"
      ? computeHmacSignature(env.RAZORPAY_KEY_SECRET, `${providerOrderId}|${providerPaymentId}`)
      : "0".repeat(64); // deliberately invalid, to exercise the signature-mismatch path

  return { providerOrderId, providerPaymentId, providerSignature };
}

// Builds a Razorpay-shaped webhook payload + its correctly-signed raw body,
// for exercising POST /payments/webhook/razorpay end to end.
export function buildSimulatedWebhook(
  providerOrderId: string,
  providerPaymentId: string,
  eventType: "payment.captured" | "payment.failed",
): { rawBody: string; signature: string } {
  const record = payments.get(providerPaymentId);
  const amountInPaise = (record?.amountInRupees ?? 0) * 100;
  const payload = {
    id: `evt_stub_${randomUUID().replace(/-/g, "")}`,
    event: eventType,
    payload: {
      payment: {
        entity: {
          id: providerPaymentId,
          order_id: providerOrderId,
          amount: amountInPaise,
          currency: record?.currency ?? "INR",
          status: eventType === "payment.captured" ? "captured" : "failed",
          method: "card",
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = computeHmacSignature(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  return { rawBody, signature };
}
