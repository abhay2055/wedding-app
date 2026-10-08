import { z } from "zod";

export const notificationListSchema = z.object({
  query: z.object({
    unreadOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid notification id") }),
});

export type NotificationListQuery = z.infer<typeof notificationListSchema>["query"];
