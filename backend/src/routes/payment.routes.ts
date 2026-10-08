import { Router } from "express";
import { Role } from "@prisma/client";
import * as paymentController from "../controllers/payment.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createRateLimiter } from "../middleware/rateLimit";
import { paymentIdParamSchema, paymentListQuerySchema, verifyPaymentSchema } from "../validators/payment.validator";

// NOTE: the Razorpay webhook (POST /api/v1/payments/webhook/razorpay) is
// intentionally NOT registered here - it needs the raw request body for
// signature verification, so it's mounted directly in app.ts, before
// express.json() runs. See app.ts for that route.

const router = Router();

const verifyRateLimit = createRateLimiter(60 * 1000, 30);

router.use(requireAuth);

// GET /:id is shared - ownership (customer owns it, or vendor is the
// booking's vendor) is checked inside payment.service.getPayment, so both
// roles are allowed through here and a mismatch 404s rather than 403s.
router.get("/:id", requireRole(Role.CUSTOMER, Role.VENDOR), validate(paymentIdParamSchema), paymentController.getPayment);

router.get("/", requireRole(Role.CUSTOMER), validate(paymentListQuerySchema), paymentController.listMyPayments);
router.post(
  "/verify",
  requireRole(Role.CUSTOMER),
  verifyRateLimit,
  validate(verifyPaymentSchema),
  paymentController.verifyPayment,
);

export default router;
