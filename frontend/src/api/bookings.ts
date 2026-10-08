import { apiClient } from "./client";
import { Booking, BookingStatus, PaginatedResult } from "../types/api";

export interface CreateBookingInput {
  vendorId: string;
  eventId: string;
  packageId: string;
  weddingDate: string;
  eventEndDate?: string;
  guestCount?: number;
  customerNotes?: string;
}

export interface BookingListParams {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}

// --- Customer ---

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const res = await apiClient.post("/bookings", input);
  return res.data.data.booking;
}

export async function listMyBookings(params: BookingListParams = {}): Promise<PaginatedResult<Booking>> {
  const res = await apiClient.get("/bookings", { params });
  return res.data.data;
}

export async function getMyBooking(id: string): Promise<Booking> {
  const res = await apiClient.get(`/bookings/${id}`);
  return res.data.data.booking;
}

export async function cancelMyBooking(id: string, reason?: string): Promise<Booking> {
  const res = await apiClient.patch(`/bookings/${id}/cancel`, { reason });
  return res.data.data.booking;
}

// --- Vendor ---

export async function listVendorBookings(params: BookingListParams = {}): Promise<PaginatedResult<Booking>> {
  const res = await apiClient.get("/vendors/me/bookings", { params });
  return res.data.data;
}

export async function getVendorBooking(id: string): Promise<Booking> {
  const res = await apiClient.get(`/vendors/me/bookings/${id}`);
  return res.data.data.booking;
}

export async function acceptVendorBooking(id: string, vendorNotes?: string): Promise<Booking> {
  const res = await apiClient.patch(`/vendors/me/bookings/${id}/accept`, { vendorNotes });
  return res.data.data.booking;
}

export async function declineVendorBooking(id: string, vendorNotes?: string): Promise<Booking> {
  const res = await apiClient.patch(`/vendors/me/bookings/${id}/decline`, { vendorNotes });
  return res.data.data.booking;
}

export async function cancelVendorBooking(id: string, reason?: string): Promise<Booking> {
  const res = await apiClient.patch(`/vendors/me/bookings/${id}/cancel`, { reason });
  return res.data.data.booking;
}

// Only reachable once the event date has passed - see
// booking.service.completeBooking on the backend.
export async function completeVendorBooking(id: string): Promise<Booking> {
  const res = await apiClient.patch(`/vendors/me/bookings/${id}/complete`, {});
  return res.data.data.booking;
}

// --- Admin (read-only) ---

export interface AdminBookingListParams extends BookingListParams {
  vendorId?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

export async function listBookingsForAdmin(params: AdminBookingListParams = {}): Promise<PaginatedResult<Booking>> {
  const res = await apiClient.get("/admin/bookings", { params });
  return res.data.data;
}
