import { apiClient } from "./client";
import { PaginatedResult, Review, ReviewStatus, VendorReviewListResult } from "../types/api";

export interface CreateReviewInput {
  rating: number;
  title?: string;
  comment: string;
}

export interface UpdateReviewInput {
  rating?: number;
  title?: string;
  comment?: string;
}

// --- Customer ---

export async function createReview(bookingId: string, input: CreateReviewInput): Promise<Review> {
  const res = await apiClient.post(`/bookings/${bookingId}/review`, input);
  return res.data.data.review;
}

export async function updateReview(id: string, input: UpdateReviewInput): Promise<Review> {
  const res = await apiClient.patch(`/reviews/${id}`, input);
  return res.data.data.review;
}

export async function deleteReview(id: string): Promise<void> {
  await apiClient.delete(`/reviews/${id}`);
}

export async function getReview(id: string): Promise<Review> {
  const res = await apiClient.get(`/reviews/${id}`);
  return res.data.data.review;
}

// --- Public ---

export async function listVendorReviews(
  vendorId: string,
  params: { page?: number; limit?: number } = {},
): Promise<VendorReviewListResult> {
  const res = await apiClient.get(`/vendors/${vendorId}/reviews`, { params });
  return res.data.data;
}

// --- Customer: own reviews (every status) ---

export async function listMyReviews(params: { page?: number; limit?: number } = {}): Promise<PaginatedResult<Review>> {
  const res = await apiClient.get("/reviews", { params });
  return res.data.data;
}

// --- Vendor: own reviews (every status) ---

export async function listMyVendorReviews(params: { page?: number; limit?: number } = {}): Promise<PaginatedResult<Review>> {
  const res = await apiClient.get("/vendors/me/reviews", { params });
  return res.data.data;
}

// --- Admin ---

export interface AdminReviewListParams {
  status?: ReviewStatus;
  vendorId?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

export async function listReviewsForAdmin(params: AdminReviewListParams = {}): Promise<PaginatedResult<Review>> {
  const res = await apiClient.get("/admin/reviews", { params });
  return res.data.data;
}

export async function moderateReview(id: string, status: ReviewStatus): Promise<Review> {
  const res = await apiClient.patch(`/admin/reviews/${id}/status`, { status });
  return res.data.data.review;
}
