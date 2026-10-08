import { z } from "zod";

export const favoriteVendorParamSchema = z.object({
  params: z.object({ vendorId: z.string().uuid("Invalid vendor id") }),
});
