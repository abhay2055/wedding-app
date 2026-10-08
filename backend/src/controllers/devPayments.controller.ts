import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import { buildSimulatedWebhook, simulateCheckoutCompletion } from "../payments/stubProvider";

// Only reachable when isStubPaymentProvider is true - see the mount guard
// in app.ts. Never exists as a route in production (RAZORPAY_KEY_ID can't
// be the stub sentinel there - see config/env.ts). Exists purely so a
// fresh clone of this repo (or Playwright/manual verification here) can
// drive the full payment flow - checkout completion and webhook delivery -
// without a real Razorpay account.

export const simulateCheckout = asyncHandler(async (req: Request, res: Response) => {
  const { providerOrderId, outcome } = req.body as { providerOrderId?: string; outcome?: "success" | "failure" };
  if (!providerOrderId) throw ApiError.badRequest("providerOrderId is required");
  const result = simulateCheckoutCompletion(providerOrderId, outcome ?? "success");
  sendSuccess(res, result);
});

export const simulateWebhook = asyncHandler(async (req: Request, res: Response) => {
  const { providerOrderId, providerPaymentId, eventType } = req.body as {
    providerOrderId?: string;
    providerPaymentId?: string;
    eventType?: "payment.captured" | "payment.failed";
  };
  if (!providerOrderId || !providerPaymentId || !eventType) {
    throw ApiError.badRequest("providerOrderId, providerPaymentId and eventType are required");
  }
  const { rawBody, signature } = buildSimulatedWebhook(providerOrderId, providerPaymentId, eventType);
  // Handed back as-is, for the caller to POST to /api/v1/payments/webhook/razorpay
  // with header X-Razorpay-Signature - this exercises the real webhook route
  // (raw body parsing, signature verification, idempotency) end to end,
  // rather than calling processRazorpayWebhook directly.
  sendSuccess(res, { rawBody, signature });
});
