import { z } from "zod";

export const vendorIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid vendor id") }),
});

export const verifyVendorSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid vendor id") }),
  body: z.object({
    verificationStatus: z.enum(["VERIFIED", "REJECTED", "PENDING"]),
  }),
});

export const setVendorStatusSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid vendor id") }),
  body: z.object({
    isActive: z.boolean(),
  }),
});

export const adminVendorListSchema = z.object({
  query: z.object({
    verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
    search: z.string().trim().max(150).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type VerifyVendorInput = z.infer<typeof verifyVendorSchema>["body"];
export type SetVendorStatusInput = z.infer<typeof setVendorStatusSchema>["body"];
export type AdminVendorListQuery = z.infer<typeof adminVendorListSchema>["query"];
