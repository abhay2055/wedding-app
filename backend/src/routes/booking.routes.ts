import { Router } from "express";
import { Role } from "@prisma/client";
import * as bookingController from "../controllers/booking.controller";
import * as paymentController from "../controllers/payment.controller";
import * as reviewController from "../controllers/review.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createRateLimiter } from "../middleware/rateLimit";
import {
  bookingIdParamSchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
} from "../validators/booking.validator";
import { bookingIdParamSchema as paymentBookingIdParamSchema } from "../validators/payment.validator";
import { createReviewSchema } from "../validators/review.validator";

const router = Router();

router.use(requireAuth, requireRole(Role.CUSTOMER));

// Booking creation does real availability/conflict work - keep it from
// being hammered, same pattern as the vendor bulk-availability endpoint.
const createBookingRateLimit = createRateLimiter(60 * 1000, 20);
const paymentOrderRateLimit = createRateLimiter(60 * 1000, 20);

router.get("/", validate(bookingListQuerySchema), bookingController.listMyBookings);
router.post("/", createBookingRateLimit, validate(createBookingSchema), bookingController.createBooking);
router.get("/:id", validate(bookingIdParamSchema), bookingController.getMyBooking);
router.patch("/:id/cancel", validate(cancelBookingSchema), bookingController.cancelMyBooking);
router.post(
  "/:bookingId/payment/order",
  paymentOrderRateLimit,
  validate(paymentBookingIdParamSchema),
  paymentController.createOrderForBooking,
);
router.post("/:bookingId/review", validate(createReviewSchema), reviewController.createReview);

export default router;
