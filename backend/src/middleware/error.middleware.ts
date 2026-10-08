import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import { isProduction } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

// Express requires exactly 4 parameters for an error-handling middleware to
// be recognized as one, even though `next` is unused here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        error: { code: "DUPLICATE_ENTRY", message: "A record with this value already exists" },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Resource not found" },
      });
      return;
    }
    // Foreign-key restrict violation, e.g. deleting a WeddingEvent or
    // VendorPackage that still has Bookings referencing it.
    if (err.code === "P2003") {
      res.status(409).json({
        success: false,
        error: {
          code: "RESOURCE_IN_USE",
          message: "This resource can't be deleted because other records still depend on it",
        },
      });
      return;
    }
  }

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again later.",
    },
  });
}
