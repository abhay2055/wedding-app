import { Router } from "express";
import * as devPaymentsController from "../controllers/devPayments.controller";

// Mounted only when isStubPaymentProvider is true - see app.ts. No auth
// guard: this never touches real user data or a real payment provider, and
// the entire router doesn't exist (404) once real Razorpay credentials or
// NODE_ENV=production are configured.
const router = Router();

router.post("/simulate-checkout", devPaymentsController.simulateCheckout);
router.post("/simulate-webhook", devPaymentsController.simulateWebhook);

export default router;
