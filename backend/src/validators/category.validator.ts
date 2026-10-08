import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid category id") }),
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(500).optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid category id") }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
