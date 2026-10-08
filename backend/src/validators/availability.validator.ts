import { z } from "zod";
import { MAX_BULK_AVAILABILITY_DAYS, MAX_SEARCH_DATE_RANGE_DAYS, daysBetweenInclusive, parseDateOnly } from "../utils/dateOnly";

// Vendors (and the bulk endpoint) can only ever set these three - BOOKED is
// reserved for Phase 4 booking to set programmatically.
const VENDOR_SETTABLE_STATUS = z.enum(["AVAILABLE", "UNAVAILABLE", "BLOCKED"]);

const dateOnlyField = z.string().refine((v) => parseDateOnly(v) !== null, {
  message: "Invalid date - expected a real calendar date in YYYY-MM-DD format",
});

export const createAvailabilitySchema = z.object({
  body: z.object({
    date: dateOnlyField,
    status: VENDOR_SETTABLE_STATUS,
    note: z.string().trim().max(500).optional(),
  }),
});

export const updateAvailabilitySchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid availability id") }),
  body: z
    .object({
      status: VENDOR_SETTABLE_STATUS.optional(),
      note: z.string().trim().max(500).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const availabilityIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid availability id") }),
});

export const bulkAvailabilitySchema = z.object({
  body: z
    .object({
      startDate: dateOnlyField,
      endDate: dateOnlyField,
      status: VENDOR_SETTABLE_STATUS,
      note: z.string().trim().max(500).optional(),
    })
    .refine((data) => parseDateOnly(data.startDate)! <= parseDateOnly(data.endDate)!, {
      message: "startDate must be on or before endDate",
      path: ["endDate"],
    })
    .refine(
      (data) => daysBetweenInclusive(parseDateOnly(data.startDate)!, parseDateOnly(data.endDate)!) <= MAX_BULK_AVAILABILITY_DAYS,
      {
        message: `Date range cannot exceed ${MAX_BULK_AVAILABILITY_DAYS} days`,
        path: ["endDate"],
      },
    ),
});

// Used both for a vendor viewing their own calendar (wide range allowed)
// and for the admin view of a vendor's calendar.
export const myAvailabilityRangeSchema = z.object({
  query: z
    .object({
      from: dateOnlyField.optional(),
      to: dateOnlyField.optional(),
    })
    .refine((data) => !data.from || !data.to || parseDateOnly(data.from)! <= parseDateOnly(data.to)!, {
      message: "from must be on or before to",
      path: ["to"],
    })
    .refine(
      (data) =>
        !data.from ||
        !data.to ||
        daysBetweenInclusive(parseDateOnly(data.from)!, parseDateOnly(data.to)!) <= MAX_BULK_AVAILABILITY_DAYS,
      { message: `Date range cannot exceed ${MAX_BULK_AVAILABILITY_DAYS} days`, path: ["to"] },
    ),
});

// Public/unauthenticated range lookups get a tighter cap than a vendor's
// own calendar view, since they're not behind auth.
export const publicAvailabilityRangeSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid vendor id") }),
  query: z
    .object({
      from: dateOnlyField.optional(),
      to: dateOnlyField.optional(),
    })
    .refine((data) => !data.from || !data.to || parseDateOnly(data.from)! <= parseDateOnly(data.to)!, {
      message: "from must be on or before to",
      path: ["to"],
    })
    .refine(
      (data) =>
        !data.from ||
        !data.to ||
        daysBetweenInclusive(parseDateOnly(data.from)!, parseDateOnly(data.to)!) <= MAX_SEARCH_DATE_RANGE_DAYS,
      { message: `Date range cannot exceed ${MAX_SEARCH_DATE_RANGE_DAYS} days`, path: ["to"] },
    ),
});

// Admin range lookup for a specific vendor (support/debugging) - same wide
// cap as the vendor's own view, since it's authenticated ADMIN-only.
export const adminVendorAvailabilityRangeSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid vendor id") }),
  query: myAvailabilityRangeSchema.shape.query,
});

// PATCH /admin/vendors/:id/availability/:date - admin can set any status,
// including reverting a Phase-4 BOOKED date back to AVAILABLE if needed,
// which is why this allows the full enum unlike the vendor-facing schemas.
export const adminSetAvailabilitySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid vendor id"),
    date: dateOnlyField,
  }),
  body: z.object({
    status: z.enum(["AVAILABLE", "UNAVAILABLE", "BLOCKED", "BOOKED"]),
    note: z.string().trim().max(500).optional(),
  }),
});

export type CreateAvailabilityInput = z.infer<typeof createAvailabilitySchema>["body"];
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>["body"];
export type BulkAvailabilityInput = z.infer<typeof bulkAvailabilitySchema>["body"];
export type AvailabilityRangeQuery = z.infer<typeof myAvailabilityRangeSchema>["query"];
export type AdminSetAvailabilityInput = z.infer<typeof adminSetAvailabilitySchema>["body"];
