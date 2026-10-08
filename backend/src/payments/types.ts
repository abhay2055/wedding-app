// Provider-agnostic payment types. `payment.service.ts` and everything
// above it only ever talks to the `PaymentProvider` interface below - never
// to Razorpay's SDK types directly - so a second provider can be added
// later (see backend/src/payments/razorpayProvider.ts vs stubProvider.ts)
// without touching booking/payment business logic.
//
// All amounts here are in whole rupees, same as the rest of the app - each
// provider implementation is responsible for converting to/from whatever
// unit its own API needs (Razorpay uses paise) at its own boundary.

export interface CreateOrderParams {
  amountInRupees: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  providerOrderId: string;
  amountInRupees: number;
  currency: string;
}

export interface VerifyPaymentSignatureParams {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface FetchPaymentResult {
  providerPaymentId: string;
  providerOrderId: string;
  status: string;
  amountInRupees: number;
  currency: string;
  method?: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: string;
  amountInRupees: number;
}

export interface WebhookVerificationResult {
  valid: boolean;
  event?: unknown;
}

export interface PaymentProvider {
  readonly name: "RAZORPAY";

  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;

  // Pure local HMAC computation, no network - this is what Razorpay's
  // checkout.js success callback fields (order_id/payment_id/signature)
  // get verified against.
  verifyPaymentSignature(params: VerifyPaymentSignatureParams): boolean;

  // Also pure local HMAC computation, over the *raw* webhook request body.
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;

  fetchPayment(providerPaymentId: string): Promise<FetchPaymentResult>;

  refundPayment(providerPaymentId: string, amountInRupees?: number): Promise<RefundResult>;
}
