import { Router } from "express";
import { Role } from "@prisma/client";
import * as vendorController from "../controllers/vendor.controller";
import * as portfolioController from "../controllers/portfolio.controller";
import * as packageController from "../controllers/package.controller";
import * as availabilityController from "../controllers/availability.controller";
import * as bookingController from "../controllers/booking.controller";
import * as paymentController from "../controllers/payment.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { optionalSingleImageUpload } from "../middleware/upload.middleware";
import { createRateLimiter } from "../middleware/rateLimit";
import {
  createVendorSchema,
  updateVendorSchema,
  vendorIdParamSchema,
  vendorSearchSchema,
  vendorSlugParamSchema,
} from "../validators/vendor.validator";
import {
  createPortfolioItemSchema,
  portfolioItemIdParamSchema,
  updatePortfolioItemSchema,
} from "../validators/portfolio.validator";
import { createPackageSchema, packageIdParamSchema, updatePackageSchema } from "../validators/package.validator";
import {
  availabilityIdParamSchema,
  bulkAvailabilitySchema,
  createAvailabilitySchema,
  myAvailabilityRangeSchema,
  publicAvailabilityRangeSchema,
  updateAvailabilitySchema,
} from "../validators/availability.validator";
import {
  acceptBookingSchema,
  bookingIdParamSchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  declineBookingSchema,
} from "../validators/booking.validator";
import { paymentListQuerySchema } from "../validators/payment.validator";
import * as reviewController from "../controllers/review.controller";
import { myVendorReviewListSchema, vendorReviewListSchema } from "../validators/review.validator";

const router = Router();
const vendorOnly = [requireAuth, requireRole(Role.VENDOR)];

// Generous DoS protection, not meant to slow normal use - see
// src/middleware/rateLimit.ts.
const searchRateLimit = createRateLimiter(60 * 1000, 120);
const availabilityLookupRateLimit = createRateLimiter(60 * 1000, 120);
const bulkAvailabilityRateLimit = createRateLimiter(60 * 1000, 10);

// --- Public ---
// NOTE: literal routes ("/me", "/me/...") are registered before the "/:id"
// catch-all further down, so "GET /vendors/me" never gets swallowed by the
// public single-vendor lookup.

router.get("/", searchRateLimit, validate(vendorSearchSchema), vendorController.searchVendors);

// --- Authenticated vendor: own profile ---

router.get("/me", ...vendorOnly, vendorController.getMyVendorProfile);
router.post("/me", ...vendorOnly, validate(createVendorSchema), vendorController.createMyVendorProfile);
router.patch("/me", ...vendorOnly, validate(updateVendorSchema), vendorController.updateMyVendorProfile);

// --- Authenticated vendor: own portfolio ---

router.get("/me/portfolio", ...vendorOnly, portfolioController.listMyPortfolio);
router.post(
  "/me/portfolio",
  ...vendorOnly,
  optionalSingleImageUpload,
  validate(createPortfolioItemSchema),
  portfolioController.addPortfolioItem,
);
router.patch(
  "/me/portfolio/:id",
  ...vendorOnly,
  validate(updatePortfolioItemSchema),
  portfolioController.updatePortfolioItem,
);
router.delete(
  "/me/portfolio/:id",
  ...vendorOnly,
  validate(portfolioItemIdParamSchema),
  portfolioController.deletePortfolioItem,
);

// --- Authenticated vendor: own packages ---

router.get("/me/packages", ...vendorOnly, packageController.listMyPackages);
router.post("/me/packages", ...vendorOnly, validate(createPackageSchema), packageController.createPackage);
router.get("/me/packages/:id", ...vendorOnly, validate(packageIdParamSchema), packageController.getMyPackage);
router.patch("/me/packages/:id", ...vendorOnly, validate(updatePackageSchema), packageController.updatePackage);
router.delete("/me/packages/:id", ...vendorOnly, validate(packageIdParamSchema), packageController.deletePackage);

// --- Authenticated vendor: own availability ---

router.get(
  "/me/availability",
  ...vendorOnly,
  validate(myAvailabilityRangeSchema),
  availabilityController.listMyAvailability,
);
router.post(
  "/me/availability",
  ...vendorOnly,
  validate(createAvailabilitySchema),
  availabilityController.setMyAvailability,
);
router.post(
  "/me/availability/bulk",
  ...vendorOnly,
  bulkAvailabilityRateLimit,
  validate(bulkAvailabilitySchema),
  availabilityController.bulkSetMyAvailability,
);
router.patch(
  "/me/availability/:id",
  ...vendorOnly,
  validate(updateAvailabilitySchema),
  availabilityController.updateMyAvailability,
);
router.delete(
  "/me/availability/:id",
  ...vendorOnly,
  validate(availabilityIdParamSchema),
  availabilityController.deleteMyAvailability,
);

// --- Authenticated vendor: own bookings ---

router.get("/me/bookings", ...vendorOnly, validate(bookingListQuerySchema), bookingController.listVendorBookings);
router.get("/me/bookings/:id", ...vendorOnly, validate(bookingIdParamSchema), bookingController.getVendorBooking);
router.patch(
  "/me/bookings/:id/accept",
  ...vendorOnly,
  validate(acceptBookingSchema),
  bookingController.acceptVendorBooking,
);
router.patch(
  "/me/bookings/:id/decline",
  ...vendorOnly,
  validate(declineBookingSchema),
  bookingController.declineVendorBooking,
);
router.patch(
  "/me/bookings/:id/cancel",
  ...vendorOnly,
  validate(cancelBookingSchema),
  bookingController.cancelVendorBooking,
);
// Only reachable once the event date has passed (see
// booking.service.completeBooking) - this is what makes the booking's
// customer eligible to leave a review.
router.patch(
  "/me/bookings/:id/complete",
  ...vendorOnly,
  validate(bookingIdParamSchema),
  bookingController.completeVendorBooking,
);

// --- Authenticated vendor: own payments (read-only - no secrets, see
// payment.service.listVendorPayments / toSafePayment) ---

router.get("/me/payments", ...vendorOnly, validate(paymentListQuerySchema), paymentController.listVendorPayments);

// --- Authenticated vendor: own reviews (all statuses - see
// review.service.listMyVendorReviews) ---

router.get("/me/reviews", ...vendorOnly, validate(myVendorReviewListSchema), reviewController.listMyVendorReviews);

// --- Public single-vendor lookup (must stay last: "/:id" would otherwise
// shadow the literal "/me" and "/slug/:slug" routes above) ---

router.get("/slug/:slug", validate(vendorSlugParamSchema), vendorController.getPublicVendorProfileBySlug);
router.get(
  "/:id/availability",
  availabilityLookupRateLimit,
  validate(publicAvailabilityRangeSchema),
  availabilityController.getPublicVendorAvailability,
);
router.get(
  "/:vendorId/reviews",
  searchRateLimit,
  validate(vendorReviewListSchema),
  reviewController.listVendorReviews,
);
router.get("/:id", validate(vendorIdParamSchema), vendorController.getPublicVendorProfile);

export default router;
