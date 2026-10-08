import { z } from "zod";

// Two ways to start/reach a conversation:
// - `vendorId` only (CUSTOMER-only): a pre-booking inquiry with a vendor.
// - `bookingId` (either party): reaches the conversation for that booking's
//   customer/vendor pair, inferring both ids from the booking itself so
//   neither party has to (or can) name the other side directly.
export const createConversationSchema = z.object({
  body: z
    .object({
      vendorId: z.string().uuid("Invalid vendor id").optional(),
      bookingId: z.string().uuid("Invalid booking id").optional(),
    })
    .refine((data) => Boolean(data.vendorId) || Boolean(data.bookingId), {
      message: "Either vendorId or bookingId is required",
      path: ["vendorId"],
    }),
});

export const conversationIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid conversation id") }),
});

export const listMessagesSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid conversation id") }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid conversation id") }),
  body: z.object({
    body: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message is too long"),
  }),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>["body"];
export type ListMessagesQuery = z.infer<typeof listMessagesSchema>["query"];
export type SendMessageInput = z.infer<typeof sendMessageSchema>["body"];
