import { z } from "zod";

export const bookingIdParamSchema = z.object({
  params: z.object({ bookingId: z.string().uuid("Invalid booking id") }),
});

export const createReviewSchema = z.object({
  params: z.object({ bookingId: z.string().uuid("Invalid booking id") }),
  body: z.object({
    rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
    title: z.string().trim().max(150).optional(),
    comment: z.string().trim().min(10, "Comment must be at least 10 characters").max(2000),
  }),
});

export const updateReviewSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid review id") }),
  body: z
    .object({
      rating: z.coerce.number().int().min(1).max(5).optional(),
      title: z.string().trim().max(150).optional(),
      comment: z.string().trim().min(10).max(2000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" }),
});

export const reviewIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid review id") }),
});

export const vendorIdParamSchema = z.object({
  params: z.object({ vendorId: z.string().uuid("Invalid vendor id") }),
});

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const vendorReviewListSchema = z.object({
  params: z.object({ vendorId: z.string().uuid("Invalid vendor id") }),
  query: paginationQuery,
});

// Vendor-facing "my reviews" - no :vendorId param (resolved from the
// authenticated vendor's own profile - see review.service.listMyVendorReviews).
export const myVendorReviewListSchema = z.object({
  query: paginationQuery,
});

const REVIEW_STATUS_FILTERS = ["PENDING", "PUBLISHED", "HIDDEN", "REJECTED"] as const;

export const adminReviewListSchema = z.object({
  query: z.object({
    status: z.enum(REVIEW_STATUS_FILTERS).optional(),
    vendorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const adminReviewStatusSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid review id") }),
  body: z.object({
    status: z.enum(REVIEW_STATUS_FILTERS),
  }),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>["body"];
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>["body"];
export type VendorReviewListQuery = z.infer<typeof vendorReviewListSchema>["query"];
export type MyVendorReviewListQuery = z.infer<typeof myVendorReviewListSchema>["query"];
export type AdminReviewListQuery = z.infer<typeof adminReviewListSchema>["query"];
export type AdminReviewStatusInput = z.infer<typeof adminReviewStatusSchema>["body"];
