import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import * as userRepository from "../repositories/user.repository";
import * as auditService from "./audit.service";
import { AdminCustomerListQuery } from "../validators/adminCustomer.validator";
import { AdminAnalyticsRange } from "../validators/adminAnalytics.validator";

// --- Customer management ---

export async function listCustomersForAdmin(query: AdminCustomerListQuery) {
  const { items, total } = await userRepository.findCustomersForAdmin(query);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function setCustomerActiveStatus(adminId: string, id: string, isActive: boolean) {
  const user = await userRepository.findUserById(id);
  if (!user || user.role !== "CUSTOMER") {
    throw ApiError.notFound("Customer not found", "CUSTOMER_NOT_FOUND");
  }
  const updated = await userRepository.updateUser(id, { isActive });
  await auditService.recordAdminAction(
    adminId,
    isActive ? "CUSTOMER_ACTIVATED" : "CUSTOMER_DEACTIVATED",
    "user",
    id,
    { from: user.isActive, to: isActive },
  );
  // passwordHash is a real column on User but never selected by
  // userRepository.updateUser's caller-visible type here - the controller
  // response DTO strips it explicitly anyway (see admin.controller.ts).
  const { passwordHash: _passwordHash, ...safe } = updated;
  return safe;
}

// --- Dashboard summary (section 26) ---

export async function getDashboardStats() {
  const [
    totalCustomers,
    totalVendors,
    verifiedVendors,
    pendingVendors,
    activeVendors,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    capturedVolume,
    successfulPayments,
    failedPayments,
    totalReviews,
    pendingReviews,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.vendor.count(),
    prisma.vendor.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.vendor.count({ where: { verificationStatus: "PENDING" } }),
    prisma.vendor.count({ where: { isActive: true } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.payment.aggregate({ where: { status: "CAPTURED" }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: "CAPTURED" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.review.count(),
    prisma.review.count({ where: { status: "PENDING" } }),
  ]);

  return {
    customers: { total: totalCustomers },
    vendors: { total: totalVendors, verified: verifiedVendors, pending: pendingVendors, active: activeVendors },
    bookings: {
      total: totalBookings,
      pending: pendingBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
    },
    payments: {
      totalVolume: capturedVolume._sum.amount ?? 0,
      successful: successfulPayments,
      failed: failedPayments,
    },
    reviews: { total: totalReviews, pending: pendingReviews },
  };
}

// --- Analytics foundation (section 35/36) ---

function boundsForRange(range: AdminAnalyticsRange): { start: Date; bucket: "day" | "month" } {
  const now = new Date();
  switch (range) {
    case "7d":
      return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), bucket: "day" };
    case "30d":
      return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), bucket: "day" };
    case "90d":
      return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), bucket: "month" };
    case "1y":
      return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), bucket: "month" };
  }
}

interface BucketRow {
  bucket: Date;
  value: number;
}

// Casts to ::int (not ::bigint) throughout - these are demo-scale
// aggregates, well within int4 range, and it sidesteps BigInt not being
// JSON-serializable by default. `bucket` is always the literal "day" or
// "month" computed above, never the raw `range` query param, so this
// interpolation is safe (Prisma still parameterizes it as a bound value,
// not string-concatenated SQL).
async function bookingsOverTime(start: Date, bucket: "day" | "month"): Promise<BucketRow[]> {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT date_trunc(${bucket}, "createdAt") AS bucket, COUNT(*)::int AS value
    FROM bookings WHERE "createdAt" >= ${start}
    GROUP BY bucket ORDER BY bucket ASC
  `;
}

async function paymentVolumeOverTime(start: Date, bucket: "day" | "month"): Promise<BucketRow[]> {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT date_trunc(${bucket}, "paidAt") AS bucket, COALESCE(SUM(amount), 0)::int AS value
    FROM payments WHERE status = 'CAPTURED' AND "paidAt" >= ${start}
    GROUP BY bucket ORDER BY bucket ASC
  `;
}

async function newCustomersOverTime(start: Date, bucket: "day" | "month"): Promise<BucketRow[]> {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT date_trunc(${bucket}, "createdAt") AS bucket, COUNT(*)::int AS value
    FROM users WHERE role = 'CUSTOMER' AND "createdAt" >= ${start}
    GROUP BY bucket ORDER BY bucket ASC
  `;
}

async function newVendorsOverTime(start: Date, bucket: "day" | "month"): Promise<BucketRow[]> {
  return prisma.$queryRaw<BucketRow[]>`
    SELECT date_trunc(${bucket}, "createdAt") AS bucket, COUNT(*)::int AS value
    FROM vendors WHERE "createdAt" >= ${start}
    GROUP BY bucket ORDER BY bucket ASC
  `;
}

export async function getAnalytics(range: AdminAnalyticsRange) {
  const { start, bucket } = boundsForRange(range);

  const [bookingsByStatus, bookingsSeries, paymentSeries, customerSeries, vendorSeries, totalReviews, pendingReviews] =
    await Promise.all([
      prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
      bookingsOverTime(start, bucket),
      paymentVolumeOverTime(start, bucket),
      newCustomersOverTime(start, bucket),
      newVendorsOverTime(start, bucket),
      prisma.review.count(),
      prisma.review.count({ where: { status: "PENDING" } }),
    ]);

  const totalBookingsAllTime = bookingsByStatus.reduce((sum, r) => sum + r._count._all, 0);
  const convertedBookings = bookingsByStatus
    .filter((r) => r.status === "CONFIRMED" || r.status === "COMPLETED")
    .reduce((sum, r) => sum + r._count._all, 0);

  return {
    range,
    bookingsByStatus: Object.fromEntries(bookingsByStatus.map((r) => [r.status, r._count._all])),
    bookingsOverTime: bookingsSeries,
    paymentVolumeOverTime: paymentSeries,
    newCustomersOverTime: customerSeries,
    newVendorsOverTime: vendorSeries,
    reviewCount: totalReviews,
    pendingReviews,
    // Simple all-time proxy for "booking conversion" (spec section 35) -
    // share of every booking ever created that reached CONFIRMED/COMPLETED,
    // not scoped to the selected time range (a range-scoped funnel would
    // need per-transition timestamps this schema doesn't track yet).
    bookingConversionRate: totalBookingsAllTime > 0 ? convertedBookings / totalBookingsAllTime : 0,
  };
}
