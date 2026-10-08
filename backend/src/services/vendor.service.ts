import { Vendor, VerificationStatus } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { slugify } from "../utils/slug";
import { parseDateOnly } from "../utils/dateOnly";
import * as vendorRepository from "../repositories/vendor.repository";
import * as categoryRepository from "../repositories/category.repository";
import * as notificationService from "./notification.service";
import * as auditService from "./audit.service";
import { CreateVendorInput, UpdateVendorInput, VendorSearchQuery } from "../validators/vendor.validator";
import { AdminVendorListQuery } from "../validators/adminVendor.validator";

export async function getMyVendorProfile(userId: string): Promise<Vendor> {
  const vendor = await vendorRepository.findVendorByUserId(userId);
  if (!vendor) {
    throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  }
  return vendor;
}

async function assertCategoryExists(categoryId: string | undefined): Promise<void> {
  if (!categoryId) return;
  const category = await categoryRepository.findCategoryById(categoryId);
  if (!category) {
    throw ApiError.badRequest("Category not found", "CATEGORY_NOT_FOUND");
  }
}

async function uniqueSlugFor(businessName: string): Promise<string> {
  const base = slugify(businessName);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const taken = await vendorRepository.isSlugTaken(candidate);
    if (!taken) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function createMyVendorProfile(userId: string, input: CreateVendorInput): Promise<Vendor> {
  const existing = await vendorRepository.findVendorByUserId(userId);
  if (existing) {
    throw ApiError.conflict("Vendor profile already exists", "VENDOR_PROFILE_EXISTS");
  }
  await assertCategoryExists(input.categoryId);

  const slug = await uniqueSlugFor(input.businessName);
  return vendorRepository.createVendor({ userId, slug, ...input });
}

export async function updateMyVendorProfile(userId: string, input: UpdateVendorInput): Promise<Vendor> {
  const existing = await vendorRepository.findVendorByUserId(userId);
  if (!existing) {
    throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  }
  await assertCategoryExists(input.categoryId);

  // The slug is intentionally left untouched here even when businessName
  // changes, so existing /vendors/:slug links (already shared, bookmarked,
  // indexed) keep working. A slug only ever changes via an explicit,
  // separate action - which Phase 2 doesn't expose yet.
  return vendorRepository.updateVendorByUserId(userId, input);
}

export async function getPublicVendorProfile(id: string) {
  const vendor = await vendorRepository.findPublicVendorById(id);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  return vendor;
}

export async function getPublicVendorProfileBySlug(slug: string) {
  const vendor = await vendorRepository.findPublicVendorBySlug(slug);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  return vendor;
}

export async function searchVendors(query: VendorSearchQuery) {
  const { items, total } = await vendorRepository.searchVendors({
    categorySlug: query.category,
    city: query.city,
    locality: query.locality,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    verified: query.verified,
    search: query.search,
    minRating: query.minRating,
    availableOn: query.availableOn ? parseDateOnly(query.availableOn)! : undefined,
    availableFrom: query.availableFrom ? parseDateOnly(query.availableFrom)! : undefined,
    availableTo: query.availableTo ? parseDateOnly(query.availableTo)! : undefined,
    page: query.page,
    limit: query.limit,
    sort: query.sort,
  });

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

// --- Admin ---

export async function listVendorsForAdmin(query: AdminVendorListQuery) {
  const { items, total } = await vendorRepository.findVendorsForAdmin(query);
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getVendorForAdmin(id: string) {
  const vendor = await vendorRepository.findVendorById(id);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  return vendor;
}

export async function setVendorVerificationStatus(
  adminId: string,
  id: string,
  status: VerificationStatus,
): Promise<Vendor> {
  const vendor = await vendorRepository.findVendorById(id);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  const updated = await vendorRepository.updateVendorById(id, { verificationStatus: status });
  await auditService.recordAdminAction(adminId, `VENDOR_${status}`, "vendor", id, {
    from: vendor.verificationStatus,
    to: status,
  });
  if (status === VerificationStatus.VERIFIED) await notificationService.notifyVendorVerified(updated);
  else if (status === VerificationStatus.REJECTED) await notificationService.notifyVendorRejected(updated);
  return updated;
}

export async function setVendorActiveStatus(adminId: string, id: string, isActive: boolean): Promise<Vendor> {
  const vendor = await vendorRepository.findVendorById(id);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }
  const updated = await vendorRepository.updateVendorById(id, { isActive });
  await auditService.recordAdminAction(adminId, isActive ? "VENDOR_ACTIVATED" : "VENDOR_DEACTIVATED", "vendor", id, {
    from: vendor.isActive,
    to: isActive,
  });
  if (isActive) await notificationService.notifyVendorActivated(updated);
  else await notificationService.notifyVendorDeactivated(updated);
  return updated;
}
