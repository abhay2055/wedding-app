import { apiClient } from "./client";
import { PaginatedResult, Vendor, VendorPublicProfile, VendorSearchResult, VendorSortOption } from "../types/api";

export interface VendorProfileInput {
  businessName: string;
  description?: string;
  city: string;
  locality?: string;
  address?: string;
  phone?: string;
  email?: string;
  categoryId?: string;
  startingPrice?: number;
  yearsExperience?: number;
}

export async function getMyVendorProfile(): Promise<Vendor> {
  const res = await apiClient.get("/vendors/me");
  return res.data.data.vendor;
}

export async function createMyVendorProfile(input: VendorProfileInput): Promise<Vendor> {
  const res = await apiClient.post("/vendors/me", input);
  return res.data.data.vendor;
}

export async function updateMyVendorProfile(input: Partial<VendorProfileInput>): Promise<Vendor> {
  const res = await apiClient.patch("/vendors/me", input);
  return res.data.data.vendor;
}

export interface VendorSearchParams {
  category?: string;
  city?: string;
  locality?: string;
  minPrice?: number;
  maxPrice?: number;
  verified?: boolean;
  search?: string;
  minRating?: number;
  // Exact-date filter: only vendors explicitly AVAILABLE that day. Mutually
  // exclusive with availableFrom/availableTo (backend rejects combining them).
  availableOn?: string;
  // Multi-day filter: only vendors AVAILABLE on every date in the range.
  availableFrom?: string;
  availableTo?: string;
  page?: number;
  limit?: number;
  sort?: VendorSortOption;
}

export async function searchVendors(params: VendorSearchParams): Promise<PaginatedResult<VendorSearchResult>> {
  const res = await apiClient.get("/vendors", { params });
  return res.data.data;
}

export async function getVendorProfileBySlug(slug: string): Promise<VendorPublicProfile> {
  const res = await apiClient.get(`/vendors/slug/${encodeURIComponent(slug)}`);
  return res.data.data.vendor;
}

export async function getVendorProfileById(id: string): Promise<VendorPublicProfile> {
  const res = await apiClient.get(`/vendors/${id}`);
  return res.data.data.vendor;
}
