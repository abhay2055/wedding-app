import { z } from "zod";

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid user id") }),
});

export const setCustomerStatusSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid user id") }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const adminCustomerListSchema = z.object({
  query: z.object({
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
    search: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type SetCustomerStatusInput = z.infer<typeof setCustomerStatusSchema>["body"];
export type AdminCustomerListQuery = z.infer<typeof adminCustomerListSchema>["query"];
