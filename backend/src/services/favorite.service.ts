import { ApiError } from "../utils/apiError";
import * as favoriteRepository from "../repositories/favorite.repository";
import * as vendorRepository from "../repositories/vendor.repository";

export function listMyFavorites(userId: string) {
  return favoriteRepository.findFavoritesByUserId(userId);
}

export async function addFavorite(userId: string, vendorId: string): Promise<void> {
  const vendor = await vendorRepository.findVendorById(vendorId);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  // Upsert on the (userId, vendorId) unique constraint - a repeated
  // favorite is a no-op, never a duplicate row or an error.
  await favoriteRepository.createFavorite(userId, vendorId);
}

export async function removeFavorite(userId: string, vendorId: string): Promise<void> {
  await favoriteRepository.deleteFavorite(userId, vendorId);
}
