import rateLimit from "express-rate-limit";
import { isTest } from "../config/env";

// Shared factory so every limiter in the app follows the same shape as the
// original auth rate limiter (standardHeaders on, skipped under the
// automated test suite). Kept generous by default - this is DoS protection,
// not meant to make normal browsing/editing feel throttled.
export function createRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest,
  });
}
