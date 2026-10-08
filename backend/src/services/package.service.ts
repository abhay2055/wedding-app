import { ApiError } from "../utils/apiError";
import * as packageRepository from "../repositories/package.repository";
import * as vendorRepository from "../repositories/vendor.repository";
import { CreatePackageInput, UpdatePackageInput } from "../validators/package.validator";

async function requireOwnVendor(userId: string) {
  const vendor = await vendorRepository.findVendorByUserId(userId);
  if (!vendor) {
    throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  }
  return vendor;
}

async function requireOwnPackage(userId: string, packageId: string) {
  const vendor = await requireOwnVendor(userId);
  const pkg = await packageRepository.findPackageById(packageId);
  // 404 rather than 403 for another vendor's package - don't confirm existence.
  if (!pkg || pkg.vendorId !== vendor.id) {
    throw ApiError.notFound("Package not found", "PACKAGE_NOT_FOUND");
  }
  return pkg;
}

export async function listMyPackages(userId: string) {
  const vendor = await requireOwnVendor(userId);
  return packageRepository.findPackagesByVendorId(vendor.id);
}

export async function getMyPackage(userId: string, packageId: string) {
  return requireOwnPackage(userId, packageId);
}

export async function createPackage(userId: string, input: CreatePackageInput) {
  const vendor = await requireOwnVendor(userId);
  return packageRepository.createPackage({
    vendorId: vendor.id,
    name: input.name,
    description: input.description,
    price: input.price,
    advancePercentage: input.advancePercentage,
    items: input.items,
  });
}

export async function updatePackage(userId: string, packageId: string, input: UpdatePackageInput) {
  await requireOwnPackage(userId, packageId);
  return packageRepository.updatePackage(packageId, input);
}

export async function deletePackage(userId: string, packageId: string): Promise<void> {
  await requireOwnPackage(userId, packageId);
  await packageRepository.deletePackage(packageId);
}
