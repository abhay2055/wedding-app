import { z } from "zod";

const packageItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const createPackageSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
    description: z.string().trim().max(2000).optional(),
    price: z.coerce.number().int().min(0, "Price cannot be negative"),
    // Whole-percent (0-100) of `price` required as an advance payment.
    // Snapshotted onto Booking.advanceAmount at booking-creation time.
    advancePercentage: z.coerce.number().int().min(0).max(100).optional(),
    items: z.array(packageItemSchema).max(50).optional(),
  }),
});

export const updatePackageSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid package id") }),
  body: z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      description: z.string().trim().max(2000).optional(),
      price: z.coerce.number().int().min(0, "Price cannot be negative").optional(),
      advancePercentage: z.coerce.number().int().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
      items: z.array(packageItemSchema).max(50).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export const packageIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid package id") }),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>["body"];
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>["body"];
export type PackageItemInput = z.infer<typeof packageItemSchema>;
