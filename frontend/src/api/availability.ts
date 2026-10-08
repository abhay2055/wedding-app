import { apiClient } from "./client";
import { PublicAvailabilityDay, VendorAvailabilityDay, VendorSettableAvailabilityStatus } from "../types/api";

export async function listMyAvailability(from?: string, to?: string): Promise<VendorAvailabilityDay[]> {
  const res = await apiClient.get("/vendors/me/availability", { params: { from, to } });
  return res.data.data.availability;
}

export async function setAvailability(
  date: string,
  status: VendorSettableAvailabilityStatus,
  note?: string,
): Promise<VendorAvailabilityDay> {
  const res = await apiClient.post("/vendors/me/availability", { date, status, note });
  return res.data.data.availability;
}

export async function bulkSetAvailability(
  startDate: string,
  endDate: string,
  status: VendorSettableAvailabilityStatus,
  note?: string,
): Promise<VendorAvailabilityDay[]> {
  const res = await apiClient.post("/vendors/me/availability/bulk", { startDate, endDate, status, note });
  return res.data.data.availability;
}

export async function updateAvailability(
  id: string,
  input: Partial<{ status: VendorSettableAvailabilityStatus; note: string }>,
): Promise<VendorAvailabilityDay> {
  const res = await apiClient.patch(`/vendors/me/availability/${id}`, input);
  return res.data.data.availability;
}

export async function deleteAvailability(id: string): Promise<void> {
  await apiClient.delete(`/vendors/me/availability/${id}`);
}

export async function getPublicAvailability(vendorId: string, from?: string, to?: string): Promise<PublicAvailabilityDay[]> {
  const res = await apiClient.get(`/vendors/${vendorId}/availability`, { params: { from, to } });
  return res.data.data.availability;
}
