import { z } from "zod";

// Deliberately excludes `email` and `role` - email changes need a
// verification flow (not built in Phase 1) and role is never client-writable.
export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\-\s]{7,20}$/, "Invalid phone number")
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field (name, phone) must be provided",
    }),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>["body"];
