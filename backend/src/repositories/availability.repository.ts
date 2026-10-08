import { AvailabilityStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

function rangeWhere(vendorId: string, from?: Date, to?: Date): Prisma.VendorAvailabilityWhereInput {
  const where: Prisma.VendorAvailabilityWhereInput = { vendorId };
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  return where;
}

export function findByVendorAndRange(vendorId: string, from?: Date, to?: Date) {
  return prisma.vendorAvailability.findMany({
    where: rangeWhere(vendorId, from, to),
    orderBy: { date: "asc" },
  });
}

export function findById(id: string) {
  return prisma.vendorAvailability.findUnique({ where: { id } });
}

export function upsertOne(vendorId: string, date: Date, status: AvailabilityStatus, note?: string) {
  return prisma.vendorAvailability.upsert({
    where: { vendorId_date: { vendorId, date } },
    create: { vendorId, date, status, note },
    update: { status, note },
  });
}

// Bounded by MAX_BULK_AVAILABILITY_DAYS at the validator layer (366 days),
// so this transaction always has a small, fixed upper bound of statements.
// One HTTP request from the frontend either way - the "bulk" part is that
// the caller doesn't have to make N requests, not that this is a single SQL
// statement.
export function upsertMany(vendorId: string, dates: Date[], status: AvailabilityStatus, note?: string) {
  return prisma.$transaction(
    dates.map((date) =>
      prisma.vendorAvailability.upsert({
        where: { vendorId_date: { vendorId, date } },
        create: { vendorId, date, status, note },
        update: { status, note },
      }),
    ),
  );
}

export function updateById(id: string, data: { status?: AvailabilityStatus; note?: string }) {
  return prisma.vendorAvailability.update({ where: { id }, data });
}

export function deleteById(id: string) {
  return prisma.vendorAvailability.delete({ where: { id } });
}

// Vendor ids that have an AVAILABLE record for every date in [from, to].
// Expressed as a single grouped raw query (COUNT(DISTINCT date) over the
// AVAILABLE rows in range must equal the number of days in the range) so
// "available for this whole multi-day event" is answered by the database
// in one query, not by loading vendors/availability into JS and looping.
export async function findVendorIdsAvailableForRange(from: Date, to: Date, dayCount: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ vendorId: string }[]>`
    SELECT "vendorId"
    FROM "vendor_availability"
    WHERE "date" >= ${from} AND "date" <= ${to} AND "status" = 'AVAILABLE'
    GROUP BY "vendorId"
    HAVING COUNT(DISTINCT "date") >= ${dayCount}
  `;
  return rows.map((r) => r.vendorId);
}
