import Razorpay from "razorpay";
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

// The only place in this codebase that converts between whole rupees (the
// unit every other model/service uses) and paise (the integer smallest-unit
// Razorpay's API requires).
function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
function paiseToRupees(paise: number): number {
  return Math.round(paise / 100);
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "RAZORPAY" as const;
  private readonly client: Razorpay;

  constructor() {
    this.client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const order = await this.client.orders.create({
      amount: rupeesToPaise(params.amountInRupees),
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      providerOrderId: order.id,
      amountInRupees: paiseToRupees(Number(order.amount)),
      currency: order.currency,
    };
  }

  verifyPaymentSignature(params: VerifyPaymentSignatureParams): boolean {
    // Razorpay's documented checkout-verification scheme: HMAC-SHA256 of
    // "order_id|payment_id" using the account's key secret.
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
    const payment = await this.client.payments.fetch(providerPaymentId);
    return {
      providerPaymentId: payment.id,
      providerOrderId: String(payment.order_id),
      status: payment.status,
      amountInRupees: paiseToRupees(Number(payment.amount)),
      currency: payment.currency,
      method: payment.method,
    };
  }

  async refundPayment(providerPaymentId: string, amountInRupees?: number): Promise<RefundResult> {
    const refund = await this.client.payments.refund(providerPaymentId, {
      amount: amountInRupees !== undefined ? rupeesToPaise(amountInRupees) : undefined,
    });
    return {
      providerRefundId: refund.id,
      status: refund.status ?? "processed",
      amountInRupees: paiseToRupees(Number(refund.amount)),
    };
  }
}
