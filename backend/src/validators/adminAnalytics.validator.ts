import { z } from "zod";

const ANALYTICS_RANGES = ["7d", "30d", "90d", "1y"] as const;

export const adminAnalyticsSchema = z.object({
  query: z.object({
    range: z.enum(ANALYTICS_RANGES).default("30d"),
  }),
});

export type AdminAnalyticsRange = (typeof ANALYTICS_RANGES)[number];
export type AdminAnalyticsQuery = z.infer<typeof adminAnalyticsSchema>["query"];
