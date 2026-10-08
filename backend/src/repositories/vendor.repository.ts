import { AvailabilityStatus, Prisma, VerificationStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { daysBetweenInclusive } from "../utils/dateOnly";
import { findVendorIdsAvailableForRange } from "./availability.repository";

export function findVendorByUserId(userId: string) {
  return prisma.vendor.findUnique({ where: { userId }, include: { category: true } });
}

export function findVendorById(id: string) {
  return prisma.vendor.findUnique({ where: { id }, include: { category: true } });
}

export function findVendorBySlug(slug: string) {
  return prisma.vendor.findUnique({ where: { slug } });
}

// Centralized public-visibility rule: only active, non-rejected vendors are
// ever visible to a public caller. PENDING vendors remain visible (they're
// just not promoted/prioritized - see buildSearchOrderBy), REJECTED never
// is. Every public-facing vendor query goes through this, so no caller can
// accidentally leak a deactivated or rejected vendor.
export function publicVendorWhere(extra: Prisma.VendorWhereInput = {}): Prisma.VendorWhereInput {
  return {
    isActive: true,
    verificationStatus: { not: VerificationStatus.REJECTED },
    ...extra,
  };
}

// Full public-facing vendor detail: category, portfolio and active packages
// with their items. Never includes `user` (which would carry passwordHash).
const publicVendorInclude = {
  category: true,
  portfolio: { orderBy: [{ sortOrder: Prisma.SortOrder.asc }, { createdAt: Prisma.SortOrder.asc }] },
  packages: {
    where: { isActive: true },
    orderBy: { createdAt: Prisma.SortOrder.asc },
    include: { items: { orderBy: { sortOrder: Prisma.SortOrder.asc } } },
  },
} satisfies Prisma.VendorInclude;

export function findPublicVendorById(id: string) {
  return prisma.vendor.findFirst({
    where: publicVendorWhere({ id }),
    include: publicVendorInclude,
  });
}

// Used for SEO-friendly /vendors/:slug pages on the frontend.
export function findPublicVendorBySlug(slug: string) {
  return prisma.vendor.findFirst({
    where: publicVendorWhere({ slug }),
    include: publicVendorInclude,
  });
}

export function createVendor(data: Prisma.VendorUncheckedCreateInput) {
  return prisma.vendor.create({ data, include: { category: true } });
}

export function updateVendorByUserId(userId: string, data: Prisma.VendorUpdateInput) {
  return prisma.vendor.update({ where: { userId }, data, include: { category: true } });
}

export function updateVendorById(id: string, data: Prisma.VendorUpdateInput) {
  return prisma.vendor.update({ where: { id }, data, include: { category: true } });
}

export async function isSlugTaken(slug: string, excludeVendorId?: string): Promise<boolean> {
  const existing = await prisma.vendor.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) return false;
  return existing.id !== excludeVendorId;
}

export interface VendorSearchFilters {
  categorySlug?: string;
  city?: string;
  locality?: string;
  minPrice?: number;
  maxPrice?: number;
  verified?: boolean;
  search?: string;
  // Single exact-date filter: vendor must have an explicit AVAILABLE record
  // for this date. A vendor with no record for the date is excluded - "no
  // record" is never treated as available (see availability.service.ts).
  availableOn?: Date;
  // Multi-day filter: vendor must have an explicit AVAILABLE record for
  // *every* date in [availableFrom, availableTo]. Resolved separately via
  // findVendorIdsAvailableForRange (see searchVendors below) since Prisma's
  // relation filters can't express "matches on all of these specific rows".
  availableFrom?: Date;
  availableTo?: Date;
  // Minimum averageRating (1-5) - filters on the denormalized Vendor
  // column, not a live aggregation over Review rows (see the
  // Vendor.averageRating schema comment).
  minRating?: number;
  page: number;
  limit: number;
  sort: "relevance" | "price_asc" | "price_desc" | "newest" | "most_events" | "rating";
}

function buildSearchWhere(filters: VendorSearchFilters, dateRangeVendorIds?: string[]): Prisma.VendorWhereInput {
  const where: Prisma.VendorWhereInput = {};

  if (filters.categorySlug) {
    where.category = { slug: filters.categorySlug };
  }
  if (filters.city) {
    where.city = { equals: filters.city, mode: "insensitive" };
  }
  if (filters.locality) {
    where.locality = { equals: filters.locality, mode: "insensitive" };
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.startingPrice = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }
  // `verified` narrows within the already-public (active, non-rejected) set
  // built by publicVendorWhere below: true -> VERIFIED only, false -> the
  // remaining PENDING-but-public vendors.
  if (filters.verified === true) {
    where.verificationStatus = VerificationStatus.VERIFIED;
  } else if (filters.verified === false) {
    where.verificationStatus = VerificationStatus.PENDING;
  }
  if (filters.search) {
    where.OR = [
      { businessName: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.availableOn) {
    where.availability = { some: { date: filters.availableOn, status: AvailabilityStatus.AVAILABLE } };
  }
  if (filters.minRating !== undefined) {
    where.averageRating = { gte: filters.minRating };
  }
  if (dateRangeVendorIds) {
    where.id = { in: dateRangeVendorIds };
  }

  return publicVendorWhere(where);
}

function buildSearchOrderBy(sort: VendorSearchFilters["sort"]): Prisma.VendorOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ startingPrice: "asc" }, { createdAt: "desc" }];
    case "price_desc":
      return [{ startingPrice: "desc" }, { createdAt: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "most_events":
      return [{ eventsCompleted: "desc" }, { createdAt: "desc" }];
    case "rating":
      // reviewCount as the tiebreaker (not just createdAt) so a vendor with
      // one lucky 5-star review doesn't outrank one with a genuinely large,
      // consistently high-rated review base.
      return [{ averageRating: "desc" }, { reviewCount: "desc" }, { createdAt: "desc" }];
    case "relevance":
    default:
      // Rating is a signal here too (Phase 6), but not the *only* one - see
      // the Phase 6 spec's "don't make rating the only ranking mechanism" -
      // verification status still comes first, then rating, then recency.
      return [{ verificationStatus: "desc" }, { averageRating: "desc" }, { createdAt: "desc" }];
  }
}

export async function searchVendors(filters: VendorSearchFilters) {
  let dateRangeVendorIds: string[] | undefined;
  if (filters.availableFrom && filters.availableTo) {
    const dayCount = daysBetweenInclusive(filters.availableFrom, filters.availableTo);
    dateRangeVendorIds = await findVendorIdsAvailableForRange(filters.availableFrom, filters.availableTo, dayCount);
  }

  const where = buildSearchWhere(filters, dateRangeVendorIds);
  const orderBy = buildSearchOrderBy(filters.sort);
  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      orderBy,
      skip,
      take: filters.limit,
      include: {
        category: true,
        portfolio: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 1 },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  return { items, total };
}

export interface AdminVendorListFilters {
  verificationStatus?: VerificationStatus;
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export async function findVendorsForAdmin(filters: AdminVendorListFilters) {
  const where: Prisma.VendorWhereInput = {};
  if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.search) {
    where.OR = [
      { businessName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: { category: true, user: { select: { name: true, email: true, phone: true } } },
    }),
    prisma.vendor.count({ where }),
  ]);

  return { items, total };
}
