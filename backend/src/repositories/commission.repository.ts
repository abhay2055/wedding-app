import { Prisma } from "@prisma/client";

export function createCommission(tx: Prisma.TransactionClient, data: Prisma.CommissionUncheckedCreateInput) {
  return tx.commission.create({ data });
}
