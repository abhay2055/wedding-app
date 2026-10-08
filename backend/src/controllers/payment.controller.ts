import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as paymentService from "../services/payment.service";
import { AdminPaymentListQuery, PaymentListQuery, RefundPaymentInput, VerifyPaymentInput } from "../validators/payment.validator";

// --- Customer: booking payment order + verify ---

export const createOrderForBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const order = await paymentService.createPaymentOrder(req.user.id, req.params.bookingId);
  sendSuccess(res, { order }, 201);
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await paymentService.verifyPayment(req.user.id, req.body as VerifyPaymentInput);
  sendSuccess(res, result);
});

// --- Reads (customer/vendor, ownership-checked in the service) ---

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const payment = await paymentService.getPayment(req.user.id, req.user.role, req.params.id);
  sendSuccess(res, { payment });
});

export const listMyPayments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await paymentService.listMyPayments(req.user.id, req.query as unknown as PaymentListQuery);
  sendSuccess(res, result);
});

export const listVendorPayments = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await paymentService.listVendorPayments(req.user.id, req.query as unknown as PaymentListQuery);
  sendSuccess(res, result);
});

// --- Admin ---

export const listPaymentsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.listPaymentsForAdmin(req.query as unknown as AdminPaymentListQuery);
  sendSuccess(res, result);
});

export const refundPayment = asyncHandler(async (req: Request, res: Response) => {
  const { amount } = req.body as RefundPaymentInput;
  const refund = await paymentService.refundPayment(req.params.id, amount);
  sendSuccess(res, { refund }, 201);
});

// --- Webhook (mounted separately in app.ts with a raw body parser) ---

export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["x-razorpay-signature"];
  await paymentService.processRazorpayWebhook(
    req.body as Buffer,
    typeof signature === "string" ? signature : undefined,
  );
  res.status(200).json({ success: true, data: { received: true } });
});
