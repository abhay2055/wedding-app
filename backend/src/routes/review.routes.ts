import { Router } from "express";
import { Role } from "@prisma/client";
import * as reviewController from "../controllers/review.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { myVendorReviewListSchema, reviewIdParamSchema, updateReviewSchema } from "../validators/review.validator";

// GET /vendors/:vendorId/reviews (public) lives in vendor.routes.ts; POST
// /bookings/:bookingId/review (customer) lives in booking.routes.ts - both
// are scoped under their parent resource's existing router, matching how
// this app already nests booking/payment/availability routes under
// /vendors and /bookings. This router holds "my reviews" plus the by-id
// review routes.

const router = Router();

router.use(requireAuth);

router.get("/", requireRole(Role.CUSTOMER), validate(myVendorReviewListSchema), reviewController.listMyReviews);
router.get("/:id", validate(reviewIdParamSchema), reviewController.getReview);
router.patch("/:id", requireRole(Role.CUSTOMER), validate(updateReviewSchema), reviewController.updateReview);
router.delete("/:id", requireRole(Role.CUSTOMER), validate(reviewIdParamSchema), reviewController.deleteReview);

export default router;
