import { z } from "zod";

const dateSchema = z.coerce.date({ invalid_type_error: "Invalid date" });

export const createEventSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(150),
      city: z.string().trim().min(2).max(100),
      weddingDate: dateSchema,
      endDate: dateSchema.optional(),
      guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1").optional(),
      budgetMin: z.coerce.number().int().min(0, "budgetMin cannot be negative").optional(),
      budgetMax: z.coerce.number().int().min(0, "budgetMax cannot be negative").optional(),
      notes: z.string().trim().max(2000).optional(),
      categoryIds: z.array(z.string().uuid()).max(20).optional(),
    })
    .refine((data) => !data.endDate || data.endDate >= data.weddingDate, {
      message: "endDate must be on or after weddingDate",
      path: ["endDate"],
    })
    .refine((data) => data.budgetMin === undefined || data.budgetMax === undefined || data.budgetMax >= data.budgetMin, {
      message: "budgetMax must be greater than or equal to budgetMin",
      path: ["budgetMax"],
    }),
});

export const updateEventSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid event id") }),
  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      city: z.string().trim().min(2).max(100).optional(),
      weddingDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      guestCount: z.coerce.number().int().min(1, "Guest count must be at least 1").optional(),
      budgetMin: z.coerce.number().int().min(0, "budgetMin cannot be negative").optional(),
      budgetMax: z.coerce.number().int().min(0, "budgetMax cannot be negative").optional(),
      notes: z.string().trim().max(2000).optional(),
      categoryIds: z.array(z.string().uuid()).max(20).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const eventIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid event id") }),
});

export type CreateEventInput = z.infer<typeof createEventSchema>["body"];
export type UpdateEventInput = z.infer<typeof updateEventSchema>["body"];
