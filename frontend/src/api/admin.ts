import { apiClient } from "./client";
import {
  AdminAnalytics,
  AdminAnalyticsRange,
  AdminCustomer,
  AdminDashboardStats,
  Category,
  PaginatedResult,
  Vendor,
  VerificationStatus,
} from "../types/api";

export async function listCategoriesForAdmin(): Promise<Category[]> {
  const res = await apiClient.get("/admin/categories");
  return res.data.data.categories;
}

export async function createCategory(input: { name: string; description?: string }): Promise<Category> {
  const res = await apiClient.post("/admin/categories", input);
  return res.data.data.category;
}

export async function updateCategory(
  id: string,
  input: Partial<{ name: string; description: string; isActive: boolean }>,
): Promise<Category> {
  const res = await apiClient.patch(`/admin/categories/${id}`, input);
  return res.data.data.category;
}

export async function deactivateCategory(id: string): Promise<Category> {
  const res = await apiClient.delete(`/admin/categories/${id}`);
  return res.data.data.category;
}

export interface AdminVendorListParams {
  verificationStatus?: VerificationStatus;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listVendorsForAdmin(params: AdminVendorListParams): Promise<PaginatedResult<Vendor>> {
  const res = await apiClient.get("/admin/vendors", { params });
  return res.data.data;
}

export async function getVendorForAdmin(id: string): Promise<Vendor> {
  const res = await apiClient.get(`/admin/vendors/${id}`);
  return res.data.data.vendor;
}

export async function verifyVendor(id: string, verificationStatus: VerificationStatus): Promise<Vendor> {
  const res = await apiClient.patch(`/admin/vendors/${id}/verify`, { verificationStatus });
  return res.data.data.vendor;
}

export async function setVendorStatus(id: string, isActive: boolean): Promise<Vendor> {
  const res = await apiClient.patch(`/admin/vendors/${id}/status`, { isActive });
  return res.data.data.vendor;
}

// --- Customers ---

export interface AdminCustomerListParams {
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listCustomersForAdmin(params: AdminCustomerListParams = {}): Promise<PaginatedResult<AdminCustomer>> {
  const res = await apiClient.get("/admin/customers", { params });
  return res.data.data;
}

export async function setCustomerStatus(id: string, isActive: boolean): Promise<AdminCustomer> {
  const res = await apiClient.patch(`/admin/customers/${id}/status`, { isActive });
  return res.data.data.customer;
}

// --- Dashboard / analytics ---

export async function getDashboardStats(): Promise<AdminDashboardStats> {
  const res = await apiClient.get("/admin/dashboard");
  return res.data.data;
}

export async function getAnalytics(range: AdminAnalyticsRange = "30d"): Promise<AdminAnalytics> {
  const res = await apiClient.get("/admin/analytics", { params: { range } });
  return res.data.data;
}
