import { z } from "zod";
import { MAX_BOOKING_DATE_RANGE_DAYS, daysBetweenInclusive, parseDateOnly } from "../utils/dateOnly";

const dateOnlyField = z.string().refine((v) => parseDateOnly(v) !== null, {
  message: "Invalid date - expected a real calendar date in YYYY-MM-DD format",
});

export const createBookingSchema = z.object({
  body: z
    .object({
      vendorId: z.string().uuid("Invalid vendor id"),
      eventId: z.string().uuid("Invalid event id"),
      packageId: z.string().uuid("Invalid package id"),
      weddingDate: dateOnlyField,
      eventEndDate: dateOnlyField.optional(),
      guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1").optional(),
      customerNotes: z.string().trim().max(2000).optional(),
    })
    .refine((data) => !data.eventEndDate || parseDateOnly(data.eventEndDate)! >= parseDateOnly(data.weddingDate)!, {
      message: "eventEndDate must be on or after weddingDate",
      path: ["eventEndDate"],
    })
    .refine(
      (data) =>
        !data.eventEndDate ||
        daysBetweenInclusive(parseDateOnly(data.weddingDate)!, parseDateOnly(data.eventEndDate)!) <=
          MAX_BOOKING_DATE_RANGE_DAYS,
      { message: `Booking date range cannot exceed ${MAX_BOOKING_DATE_RANGE_DAYS} days`, path: ["eventEndDate"] },
    ),
});

export const bookingIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid booking id") }),
});

export const declineBookingSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid booking id") }),
  body: z.object({
    vendorNotes: z.string().trim().max(2000).optional(),
  }),
});

export const acceptBookingSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid booking id") }),
  body: z.object({
    vendorNotes: z.string().trim().max(2000).optional(),
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid booking id") }),
  body: z.object({
    reason: z.string().trim().max(2000).optional(),
  }),
});

const BOOKING_STATUS_FILTERS = [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
  "PAYMENT_PENDING",
  "CONFIRMED",
] as const;

export const bookingListQuerySchema = z.object({
  query: z.object({
    status: z.enum(BOOKING_STATUS_FILTERS).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// Admin: read-only booking inspection, per Phase 4 scope (no admin actions
// on bookings yet).
export const adminBookingListQuerySchema = z.object({
  query: z.object({
    status: z.enum(BOOKING_STATUS_FILTERS).optional(),
    vendorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    from: dateOnlyField.optional(),
    to: dateOnlyField.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>["body"];
export type DeclineBookingInput = z.infer<typeof declineBookingSchema>["body"];
export type AcceptBookingInput = z.infer<typeof acceptBookingSchema>["body"];
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>["body"];
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>["query"];
export type AdminBookingListQuery = z.infer<typeof adminBookingListQuerySchema>["query"];
