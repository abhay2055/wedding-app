import { apiClient } from "./client";
import { PaginatedResult, Payment, PaymentOrder, PaymentStatus, VerifyPaymentInput, VerifyPaymentResult } from "../types/api";

export interface PaymentListParams {
  status?: PaymentStatus;
  page?: number;
  limit?: number;
}

// --- Customer ---

export async function createPaymentOrder(bookingId: string): Promise<PaymentOrder> {
  const res = await apiClient.post(`/bookings/${bookingId}/payment/order`);
  return res.data.data.order;
}

export async function verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
  const res = await apiClient.post("/payments/verify", input);
  return res.data.data;
}

export async function listMyPayments(params: PaymentListParams = {}): Promise<PaginatedResult<Payment>> {
  const res = await apiClient.get("/payments", { params });
  return res.data.data;
}

// --- Shared (customer owner or the booking's vendor - see backend IDOR check) ---

export async function getPayment(id: string): Promise<Payment> {
  const res = await apiClient.get(`/payments/${id}`);
  return res.data.data.payment;
}

// --- Vendor ---

export async function listVendorPayments(params: PaymentListParams = {}): Promise<PaginatedResult<Payment>> {
  const res = await apiClient.get("/vendors/me/payments", { params });
  return res.data.data;
}

// --- Admin ---

export interface AdminPaymentListParams extends PaymentListParams {
  vendorId?: string;
  customerId?: string;
  bookingId?: string;
}

export async function listPaymentsForAdmin(params: AdminPaymentListParams = {}): Promise<PaginatedResult<Payment>> {
  const res = await apiClient.get("/admin/payments", { params });
  return res.data.data;
}

export async function refundPayment(id: string, amount?: number, reason?: string): Promise<Payment> {
  const res = await apiClient.post(`/admin/payments/${id}/refund`, { amount, reason });
  return res.data.data.refund;
}
