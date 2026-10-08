import { apiClient } from "./client";
import { FavoriteVendor } from "../types/api";

export async function listMyFavorites(): Promise<FavoriteVendor[]> {
  const res = await apiClient.get("/favorites");
  return res.data.data.favorites;
}

export async function addFavorite(vendorId: string): Promise<void> {
  await apiClient.post(`/favorites/${vendorId}`);
}

export async function removeFavorite(vendorId: string): Promise<void> {
  await apiClient.delete(`/favorites/${vendorId}`);
}
