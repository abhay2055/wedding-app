import { apiClient } from "./client";

// Only reachable on the backend when the stub payment provider is active
// (never in production - see isStubPaymentProvider in the backend's
// config/env.ts). Used by PayAdvanceButton in place of loading real
// Razorpay Checkout whenever the order's razorpayKeyId is the dev/test
// sentinel, so the whole payment flow is exercisable in a browser without
// a real Razorpay account. See backend/src/controllers/devPayments.controller.ts.

export const STUB_KEY_PREFIX = "rzp_test_stub";

export interface SimulatedCheckoutResult {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export async function simulateCheckout(
  providerOrderId: string,
  outcome: "success" | "failure" = "success",
): Promise<SimulatedCheckoutResult> {
  const res = await apiClient.post("/dev/payments/simulate-checkout", { providerOrderId, outcome });
  return res.data.data;
}
