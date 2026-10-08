import { BookingStatus, ReviewStatus, Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { sanitizePlainText } from "../utils/sanitize";
import * as reviewRepository from "../repositories/review.repository";
import * as vendorRepository from "../repositories/vendor.repository";
import * as notificationService from "./notification.service";
import * as auditService from "./audit.service";
import {
  AdminReviewListQuery,
  CreateReviewInput,
  MyVendorReviewListQuery,
  UpdateReviewInput,
  VendorReviewListQuery,
} from "../validators/review.validator";

const EDITABLE_STATUSES: ReviewStatus[] = [ReviewStatus.PENDING, ReviewStatus.PUBLISHED];

// --- Customer: create ---

export async function createReview(customerId: string, bookingId: string, input: CreateReviewInput) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  // 404, not 403/409 - never confirm a booking exists to someone who
  // doesn't own it (same IDOR pattern as every other booking-scoped route).
  if (!booking || booking.customerId !== customerId) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }
  if (booking.status !== BookingStatus.COMPLETED) {
    throw ApiError.conflict(
      `Only a COMPLETED booking can be reviewed (current status: ${booking.status})`,
      "BOOKING_NOT_COMPLETED",
    );
  }
  const existing = await reviewRepository.findReviewByBookingId(bookingId);
  if (existing) {
    throw ApiError.conflict("This booking already has a review", "REVIEW_ALREADY_EXISTS");
  }

  const status = env.REVIEW_AUTO_PUBLISH ? ReviewStatus.PUBLISHED : ReviewStatus.PENDING;

  const review = await prisma.$transaction(async (tx) => {
    const created = await reviewRepository.createReview({
      bookingId,
      customerId,
      vendorId: booking.vendorId,
      rating: input.rating,
      title: input.title ? sanitizePlainText(input.title) : undefined,
      comment: sanitizePlainText(input.comment),
      status,
    });
    if (status === ReviewStatus.PUBLISHED) {
      await reviewRepository.recalculateVendorRating(tx, booking.vendorId);
    }
    return created;
  });

  await notificationService.notifyReviewReceived(review);
  return review;
}

export async function listMyReviews(customerId: string, query: MyVendorReviewListQuery) {
  const { items, total } = await reviewRepository.findReviewsForCustomer(customerId, query);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

// --- Reads ---

// A PUBLISHED review is visible to any authenticated caller; anything else
// (PENDING/HIDDEN/REJECTED) only to the reviewing customer, the reviewed
// vendor's own account, or an admin - never a random other user.
export async function getReview(userId: string, role: Role, id: string) {
  const review = await reviewRepository.findReviewById(id);
  if (!review) throw ApiError.notFound("Review not found", "REVIEW_NOT_FOUND");
  if (review.status === ReviewStatus.PUBLISHED) return review;

  const isOwner = role === Role.CUSTOMER && review.customerId === userId;
  let isVendorParty = false;
  if (!isOwner && role === Role.VENDOR) {
    const vendor = await vendorRepository.findVendorByUserId(userId);
    isVendorParty = Boolean(vendor && vendor.id === review.vendorId);
  }
  if (!isOwner && !isVendorParty && role !== Role.ADMIN) {
    throw ApiError.notFound("Review not found", "REVIEW_NOT_FOUND");
  }
  return review;
}

export async function listVendorReviews(vendorId: string, query: VendorReviewListQuery) {
  const vendor = await vendorRepository.findVendorById(vendorId);
  if (!vendor) throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");

  const [{ items, total }, distribution] = await Promise.all([
    reviewRepository.findPublishedReviewsForVendor(vendorId, query),
    reviewRepository.ratingDistributionForVendor(vendorId),
  ]);

  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    summary: {
      averageRating: vendor.averageRating,
      reviewCount: vendor.reviewCount,
      distribution,
    },
  };
}

export async function listMyVendorReviews(vendorUserId: string, query: VendorReviewListQuery) {
  const vendor = await vendorRepository.findVendorByUserId(vendorUserId);
  if (!vendor) throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  const { items, total } = await reviewRepository.findReviewsForVendorOwner(vendor.id, query);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

// --- Customer: edit/delete own review ---

export async function updateReview(customerId: string, id: string, input: UpdateReviewInput) {
  const review = await reviewRepository.findReviewById(id);
  if (!review || review.customerId !== customerId) {
    throw ApiError.notFound("Review not found", "REVIEW_NOT_FOUND");
  }
  if (!EDITABLE_STATUSES.includes(review.status)) {
    throw ApiError.conflict(`A review with status ${review.status} cannot be edited`, "REVIEW_NOT_EDITABLE");
  }

  // An edit re-enters moderation unless this deployment auto-publishes -
  // see the REVIEW_AUTO_PUBLISH comment in config/env.ts and the Phase 6
  // spec's "an edited review may return to PENDING if moderation is
  // enabled" rule.
  const nextStatus = env.REVIEW_AUTO_PUBLISH ? ReviewStatus.PUBLISHED : ReviewStatus.PENDING;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await reviewRepository.updateReview(id, {
      rating: input.rating,
      title: input.title !== undefined ? sanitizePlainText(input.title) : undefined,
      comment: input.comment !== undefined ? sanitizePlainText(input.comment) : undefined,
      status: nextStatus,
    });
    // Recalculated unconditionally - covers every case that could change
    // the vendor's public rating: leaving PUBLISHED, staying PUBLISHED with
    // a new rating value (auto-publish mode), or re-entering PENDING.
    await reviewRepository.recalculateVendorRating(tx, review.vendorId);
    return result;
  });

  return updated;
}

export async function deleteReview(customerId: string, id: string): Promise<void> {
  const review = await reviewRepository.findReviewById(id);
  if (!review || review.customerId !== customerId) {
    throw ApiError.notFound("Review not found", "REVIEW_NOT_FOUND");
  }
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    await reviewRepository.recalculateVendorRating(tx, review.vendorId);
  });
}

// --- Admin ---

export async function listReviewsForAdmin(query: AdminReviewListQuery) {
  const { items, total } = await reviewRepository.findReviewsForAdmin(query);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function moderateReview(adminId: string, id: string, status: ReviewStatus) {
  const review = await reviewRepository.findReviewById(id);
  if (!review) throw ApiError.notFound("Review not found", "REVIEW_NOT_FOUND");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await reviewRepository.updateReview(id, { status });
    await reviewRepository.recalculateVendorRating(tx, review.vendorId);
    return result;
  });

  await auditService.recordAdminAction(adminId, `REVIEW_${status}`, "review", id, {
    from: review.status,
    to: status,
  });

  if (status === ReviewStatus.PUBLISHED) await notificationService.notifyReviewPublished(updated);
  else if (status === ReviewStatus.REJECTED) await notificationService.notifyReviewRejected(updated);
  // HIDDEN pulls an already-public review from view without implying it
  // was ever "rejected" - deliberately no customer notification type for
  // this one (see notification.service.ts's NotificationType list).

  return updated;
}
