import { z } from "zod";

export const createPortfolioItemSchema = z.object({
  body: z.object({
    type: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
    // Only used when type is VIDEO - IMAGE items come from the uploaded file.
    url: z.string().trim().url("Must be a valid URL").optional(),
    title: z.string().trim().max(150).optional(),
    description: z.string().trim().max(1000).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
});

export const updatePortfolioItemSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid portfolio item id") }),
  body: z
    .object({
      title: z.string().trim().max(150).optional(),
      description: z.string().trim().max(1000).optional(),
      sortOrder: z.coerce.number().int().min(0).optional(),
      url: z.string().trim().url("Must be a valid URL").optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const portfolioItemIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid portfolio item id") }),
});

export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>["body"];
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>["body"];
