import { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

const reviewInclude = {
  customer: { select: { id: true, name: true } },
  vendor: { select: { id: true, businessName: true, slug: true } },
  booking: { select: { id: true, bookingNumber: true, status: true } },
} satisfies Prisma.ReviewInclude;

export function findReviewByBookingId(bookingId: string) {
  return prisma.review.findUnique({ where: { bookingId }, include: reviewInclude });
}

export function findReviewById(id: string) {
  return prisma.review.findUnique({ where: { id }, include: reviewInclude });
}

export function createReview(data: Prisma.ReviewUncheckedCreateInput) {
  return prisma.review.create({ data, include: reviewInclude });
}

export function updateReview(id: string, data: Prisma.ReviewUpdateInput) {
  return prisma.review.update({ where: { id }, data, include: reviewInclude });
}

export function deleteReview(id: string) {
  return prisma.review.delete({ where: { id } });
}

export interface PublicReviewListFilters {
  page: number;
  limit: number;
}

// Public: PUBLISHED only, never hidden/pending/rejected - see
// review.service.ts for where this boundary is enforced.
export async function findPublishedReviewsForVendor(vendorId: string, filters: PublicReviewListFilters) {
  const where: Prisma.ReviewWhereInput = { vendorId, status: ReviewStatus.PUBLISHED };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

// Vendor-facing "my reviews" - unlike the public endpoint, this includes
// every status (a vendor should see a PENDING review the moment they're
// notified about it, not just once it's published) - but it's still only
// ever reachable for the vendor's own vendorId (see review.service.ts).
export async function findReviewsForVendorOwner(vendorId: string, filters: PublicReviewListFilters) {
  const where: Prisma.ReviewWhereInput = { vendorId };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

// Customer-facing "my reviews" - every status of the customer's own
// reviews (they should see a PENDING one they just submitted, not just
// once it's published).
export async function findReviewsForCustomer(customerId: string, filters: PublicReviewListFilters) {
  const where: Prisma.ReviewWhereInput = { customerId };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: reviewInclude,
    }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

export interface AdminReviewListFilters {
  status?: ReviewStatus;
  vendorId?: string;
  customerId?: string;
  page: number;
  limit: number;
}

export async function findReviewsForAdmin(filters: AdminReviewListFilters) {
  const where: Prisma.ReviewWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: filters.limit, include: reviewInclude }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

// Recomputed (never incrementally patched) from every PUBLISHED review for
// this vendor - see the Vendor.averageRating schema comment for why. Always
// called from inside the same transaction as the review write that could
// have changed the PUBLISHED set, so it's always consistent and race-safe.
export async function recalculateVendorRating(tx: Prisma.TransactionClient, vendorId: string): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { vendorId, status: ReviewStatus.PUBLISHED },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.vendor.update({
    where: { id: vendorId },
    data: {
      averageRating: agg._avg.rating ?? 0,
      reviewCount: agg._count._all,
    },
  });
}

// One-query rating distribution ({1: n, 2: n, ...}) for the public vendor
// profile's "5★ - 100, 4★ - 18, ..." breakdown.
export async function ratingDistributionForVendor(vendorId: string): Promise<Record<number, number>> {
  const rows = await prisma.review.groupBy({
    by: ["rating"],
    where: { vendorId, status: ReviewStatus.PUBLISHED },
    _count: { _all: true },
  });
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) distribution[row.rating] = row._count._all;
  return distribution;
}
