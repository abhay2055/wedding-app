import { apiClient } from "./client";
import { VendorPackage } from "../types/api";

export interface PackageItemInput {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface PackageInput {
  name: string;
  description?: string;
  price: number;
  advancePercentage?: number;
  items?: PackageItemInput[];
}

export async function listMyPackages(): Promise<VendorPackage[]> {
  const res = await apiClient.get("/vendors/me/packages");
  return res.data.data.packages;
}

export async function createPackage(input: PackageInput): Promise<VendorPackage> {
  const res = await apiClient.post("/vendors/me/packages", input);
  return res.data.data.package;
}

export async function updatePackage(id: string, input: Partial<PackageInput> & { isActive?: boolean }): Promise<VendorPackage> {
  const res = await apiClient.patch(`/vendors/me/packages/${id}`, input);
  return res.data.data.package;
}

export async function deletePackage(id: string): Promise<void> {
  await apiClient.delete(`/vendors/me/packages/${id}`);
}
