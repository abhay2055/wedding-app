import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  FRONTEND_URL: z.string().min(1).default("http://localhost:5173"),
  BACKEND_PUBLIC_URL: z.string().min(1).default("http://localhost:4000"),

  // Razorpay. The "rzp_test_stub_..." defaults are a deliberate sentinel,
  // never a real Razorpay key format (real test keys look like
  // "rzp_test_XXXXXXXXXXXXXX") - see backend/src/payments/index.ts, which
  // picks the in-process StubPaymentProvider instead of the real Razorpay
  // SDK whenever RAZORPAY_KEY_ID still has this default, so a fresh clone
  // works end-to-end with zero payment-provider setup. Fill in real
  // rzp_test_/rzp_live_ credentials to use the real provider.
  RAZORPAY_KEY_ID: z.string().min(1).default("rzp_test_stub_dev_only"),
  RAZORPAY_KEY_SECRET: z.string().min(1).default("stub_dev_secret_do_not_use_in_prod"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).default("stub_dev_webhook_secret_do_not_use_in_prod"),

  // Whole-percent platform commission applied to every captured payment.
  // Phase 5 keeps this a single global default (env-configured); per-
  // category/per-vendor overrides are a Phase 6+ extension point - see
  // commission.service.ts.
  PLATFORM_COMMISSION_PERCENTAGE: z.coerce.number().int().min(0).max(100).default(10),

  // false (default): a new/edited review starts PENDING and only becomes
  // publicly visible (and starts affecting Vendor.averageRating) once an
  // admin publishes it - see review.service.ts. true: reviews are
  // immediately PUBLISHED, for a deployment that doesn't want moderation.
  REVIEW_AUTO_PUBLISH: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check your .env file against .env.example.");
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

// Never allow the fake/no-network payment provider to run in production -
// see backend/src/payments/index.ts for where this gates the provider choice.
export const isStubPaymentProvider = env.RAZORPAY_KEY_ID.startsWith("rzp_test_stub");

if (isProduction && isStubPaymentProvider) {
  throw new Error(
    "RAZORPAY_KEY_ID is still the development stub value in a production environment. " +
      "Configure real Razorpay credentials before starting the server in production.",
  );
}
