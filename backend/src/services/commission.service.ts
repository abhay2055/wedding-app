import { env } from "../config/env";

export interface CommissionCalculation {
  percentage: number;
  grossAmount: number;
  commissionAmount: number;
  vendorAmount: number;
}

// Phase 5 keeps this a single global default from PLATFORM_COMMISSION_PERCENTAGE
// - category/vendor-specific overrides are a documented Phase 6+ extension
// point (see README). Kept as its own function (not inlined in
// payment.service.ts) so that extension only ever has one call site to change.
export function calculate(grossAmount: number): CommissionCalculation {
  const percentage = env.PLATFORM_COMMISSION_PERCENTAGE;
  const commissionAmount = Math.round((grossAmount * percentage) / 100);
  const vendorAmount = grossAmount - commissionAmount;
  return { percentage, grossAmount, commissionAmount, vendorAmount };
}
