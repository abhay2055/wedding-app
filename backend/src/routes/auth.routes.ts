import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import { createRateLimiter } from "../middleware/rateLimit";

const router = Router();

// Basic brute-force protection on credential-guessing endpoints. Skipped
// under the automated test suite, which legitimately logs in far more than
// 20 times per run (many independent test users) and isn't attacking anyone.
const authRateLimit = createRateLimiter(15 * 60 * 1000, 20);

router.post("/register", authRateLimit, validate(registerSchema), authController.register);
router.post("/login", authRateLimit, validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

export default router;
