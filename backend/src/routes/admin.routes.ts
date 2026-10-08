import { Router } from "express";
import { Role } from "@prisma/client";
import * as adminController from "../controllers/admin.controller";
import * as availabilityController from "../controllers/availability.controller";
import * as bookingController from "../controllers/booking.controller";
import * as paymentController from "../controllers/payment.controller";
import * as reviewController from "../controllers/review.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validator";
import {
  adminVendorListSchema,
  setVendorStatusSchema,
  vendorIdParamSchema,
  verifyVendorSchema,
} from "../validators/adminVendor.validator";
import {
  adminSetAvailabilitySchema,
  adminVendorAvailabilityRangeSchema,
} from "../validators/availability.validator";
import { adminBookingListQuerySchema } from "../validators/booking.validator";
import { adminPaymentListQuerySchema, refundPaymentSchema } from "../validators/payment.validator";
import { adminReviewListSchema, adminReviewStatusSchema } from "../validators/review.validator";
import { adminCustomerListSchema, setCustomerStatusSchema } from "../validators/adminCustomer.validator";
import { adminAnalyticsSchema } from "../validators/adminAnalytics.validator";

const router = Router();

router.use(requireAuth, requireRole(Role.ADMIN));

router.get("/me", adminController.getMe);

// --- Dashboard / analytics ---

router.get("/dashboard", adminController.getDashboardStats);
router.get("/analytics", validate(adminAnalyticsSchema), adminController.getAnalytics);

// --- Categories ---

router.get("/categories", adminController.listCategories);
router.post("/categories", validate(createCategorySchema), adminController.createCategory);
router.patch("/categories/:id", validate(updateCategorySchema), adminController.updateCategory);
// Soft-deactivation, not a destructive delete - see admin.controller.deactivateCategory.
router.delete("/categories/:id", validate(categoryIdParamSchema), adminController.deactivateCategory);

// --- Vendors ---

router.get("/vendors", validate(adminVendorListSchema), adminController.listVendors);
router.get("/vendors/:id", validate(vendorIdParamSchema), adminController.getVendor);
router.patch("/vendors/:id/verify", validate(verifyVendorSchema), adminController.verifyVendor);
router.patch("/vendors/:id/status", validate(setVendorStatusSchema), adminController.setVendorStatus);

// --- Customers ---

router.get("/customers", validate(adminCustomerListSchema), adminController.listCustomers);
router.patch("/customers/:id/status", validate(setCustomerStatusSchema), adminController.setCustomerStatus);

// --- Vendor availability (support/debugging) ---

router.get(
  "/vendors/:id/availability",
  validate(adminVendorAvailabilityRangeSchema),
  availabilityController.getVendorAvailabilityForAdmin,
);
// Every write here is recorded to AdminAuditLog - see availability.service.adminSetVendorAvailability.
router.patch(
  "/vendors/:id/availability/:date",
  validate(adminSetAvailabilitySchema),
  availabilityController.adminSetVendorAvailability,
);

// --- Bookings (read-only for Phase 4 - support/debugging visibility only) ---

router.get("/bookings", validate(adminBookingListQuerySchema), bookingController.listBookingsForAdmin);

// --- Payments ---

router.get("/payments", validate(adminPaymentListQuerySchema), paymentController.listPaymentsForAdmin);
// Full or partial refund. Amount defaults to whatever remains unrefunded -
// see payment.service.refundPayment. No automatic vendor payout/settlement
// is triggered - Phase 5 records the refund only (see spec: refund
// foundation, not automation).
router.post("/payments/:id/refund", validate(refundPaymentSchema), paymentController.refundPayment);

// --- Reviews (moderation) ---

router.get("/reviews", validate(adminReviewListSchema), reviewController.listReviewsForAdmin);
router.patch("/reviews/:id/status", validate(adminReviewStatusSchema), reviewController.moderateReview);

export default router;
