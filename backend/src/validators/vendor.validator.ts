import { z } from "zod";
import { MAX_SEARCH_DATE_RANGE_DAYS, daysBetweenInclusive, parseDateOnly } from "../utils/dateOnly";

const SORT_OPTIONS = ["relevance", "price_asc", "price_desc", "newest", "most_events", "rating"] as const;

const dateOnlyField = z.string().refine((v) => parseDateOnly(v) !== null, {
  message: "Invalid date - expected a real calendar date in YYYY-MM-DD format",
});

export const createVendorSchema = z.object({
  body: z.object({
    businessName: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).optional(),
    city: z.string().trim().min(2).max(100),
    locality: z.string().trim().max(100).optional(),
    address: z.string().trim().max(300).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{7,20}$/, "Invalid phone number")
      .optional(),
    email: z.string().trim().toLowerCase().email("Invalid email address").optional(),
    categoryId: z.string().uuid("Invalid category id").optional(),
    startingPrice: z.coerce.number().int().nonnegative().optional(),
    yearsExperience: z.coerce.number().int().min(0).max(100).optional(),
  }),
});

export const updateVendorSchema = z.object({
  body: z
    .object({
      businessName: z.string().trim().min(2).max(150).optional(),
      description: z.string().trim().max(2000).optional(),
      city: z.string().trim().min(2).max(100).optional(),
      locality: z.string().trim().max(100).optional(),
      address: z.string().trim().max(300).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\-\s]{7,20}$/, "Invalid phone number")
        .optional(),
      email: z.string().trim().toLowerCase().email("Invalid email address").optional(),
      categoryId: z.string().uuid("Invalid category id").optional(),
      startingPrice: z.coerce.number().int().nonnegative().optional(),
      yearsExperience: z.coerce.number().int().min(0).max(100).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const vendorSearchSchema = z.object({
  query: z
    .object({
      category: z.string().trim().max(100).optional(),
      city: z.string().trim().max(100).optional(),
      locality: z.string().trim().max(100).optional(),
      minPrice: z.coerce.number().int().nonnegative().optional(),
      maxPrice: z.coerce.number().int().nonnegative().optional(),
      verified: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
      search: z.string().trim().max(150).optional(),
      minRating: z.coerce.number().min(1).max(5).optional(),
      // Single-date "available on this exact date" filter.
      availableOn: dateOnlyField.optional(),
      // Multi-day "available for this whole range" filter - both or neither.
      availableFrom: dateOnlyField.optional(),
      availableTo: dateOnlyField.optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      sort: z.enum(SORT_OPTIONS).default("relevance"),
    })
    .refine((data) => !data.availableOn || (!data.availableFrom && !data.availableTo), {
      message: "availableOn cannot be combined with availableFrom/availableTo",
      path: ["availableOn"],
    })
    .refine((data) => Boolean(data.availableFrom) === Boolean(data.availableTo), {
      message: "availableFrom and availableTo must be provided together",
      path: ["availableTo"],
    })
    .refine(
      (data) => !data.availableFrom || !data.availableTo || parseDateOnly(data.availableFrom)! <= parseDateOnly(data.availableTo)!,
      { message: "availableFrom must be on or before availableTo", path: ["availableTo"] },
    )
    .refine(
      (data) =>
        !data.availableFrom ||
        !data.availableTo ||
        daysBetweenInclusive(parseDateOnly(data.availableFrom)!, parseDateOnly(data.availableTo)!) <= MAX_SEARCH_DATE_RANGE_DAYS,
      { message: `availableFrom/availableTo range cannot exceed ${MAX_SEARCH_DATE_RANGE_DAYS} days`, path: ["availableTo"] },
    ),
});

export const vendorIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid vendor id") }),
});

export const vendorSlugParamSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1).max(120) }),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>["body"];
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>["body"];
export type VendorSearchQuery = z.infer<typeof vendorSearchSchema>["query"];
