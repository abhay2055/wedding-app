import path from "path";
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env, isStubPaymentProvider } from "./config/env";
import apiV1Router from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { razorpayWebhook } from "./controllers/payment.controller";
import devPaymentsRoutes from "./routes/devPayments.routes";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Behind nginx in production: trust its X-Forwarded-* headers (client IP, protocol).
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  // Mounted BEFORE express.json(): Razorpay webhook signature verification
  // needs the exact raw request bytes, not a re-serialized JSON.parse()
  // result (see payment.service.processRazorpayWebhook / payments/signature.ts).
  app.post("/api/v1/payments/webhook/razorpay", express.raw({ type: "application/json" }), razorpayWebhook);

  app.use(express.json());
  app.use(cookieParser());

  // Uploaded vendor portfolio images, served to a different-origin frontend.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(path.join(process.cwd(), "uploads")),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, data: { status: "ok" } });
  });

  app.use("/api/v1", apiV1Router);

  // Only exists when the stub payment provider is active (never in
  // production - see isStubPaymentProvider in config/env.ts, which also
  // throws at startup if it's ever true alongside isProduction). Not
  // mounting the router at all, rather than mounting it with an inline
  // guard, is what makes it a real 404 instead of a checked-but-reachable route.
  if (isStubPaymentProvider) {
    app.use("/api/v1/dev/payments", devPaymentsRoutes);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
