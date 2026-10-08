import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

// Customer-facing include: the vendor's own public business fields (already
// public via the vendor's profile) but never `vendor.user` (the owner's
// personal account). `review` is just enough (id + status) for the
// frontend to know whether this booking already has a review, and if so
// whether it's still PENDING moderation - without a second round-trip or
// exposing the full comment/title here.
const customerBookingInclude = {
  vendor: { include: { category: true } },
  event: { select: { id: true, name: true, city: true } },
  package: { include: { items: true } },
  review: { select: { id: true, status: true } },
} satisfies Prisma.BookingInclude;

// Vendor-facing include: the customer's contact details (name/phone/email)
// so the vendor can actually plan the event - the same level of contact
// exposure the admin vendor list already grants for a vendor's own owner.
const vendorBookingInclude = {
  customer: { select: { id: true, name: true, phone: true, email: true } },
  event: { select: { id: true, name: true, city: true } },
  package: { include: { items: true } },
  review: { select: { id: true, status: true } },
} satisfies Prisma.BookingInclude;

export function findBookingByIdForCustomer(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: customerBookingInclude });
}

export function findBookingByIdForVendor(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: vendorBookingInclude });
}

// Ownership-agnostic lookup used internally by the service layer (e.g. to
// resolve the vendorId/customerId before deciding which include to use).
export function findBookingById(id: string) {
  return prisma.booking.findUnique({ where: { id } });
}

export interface BookingListFilters {
  status?: BookingStatus;
  page: number;
  limit: number;
}

export async function findBookingsByCustomer(customerId: string, filters: BookingListFilters) {
  const where: Prisma.BookingWhereInput = { customerId, ...(filters.status ? { status: filters.status } : {}) };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: customerBookingInclude,
    }),
    prisma.booking.count({ where }),
  ]);
  return { items, total };
}

export async function findBookingsByVendor(vendorId: string, filters: BookingListFilters) {
  const where: Prisma.BookingWhereInput = { vendorId, ...(filters.status ? { status: filters.status } : {}) };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: vendorBookingInclude,
    }),
    prisma.booking.count({ where }),
  ]);
  return { items, total };
}

export interface AdminBookingListFilters {
  status?: BookingStatus;
  vendorId?: string;
  customerId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function findBookingsForAdmin(filters: AdminBookingListFilters) {
  const where: Prisma.BookingWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };
  if (filters.from || filters.to) {
    where.weddingDate = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, businessName: true, slug: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);
  return { items, total };
}

// Overlapping ACCEPTED bookings for a vendor across a date range - used as
// a defense-in-depth check alongside the VendorAvailability conditional
// update (see the Booking model's schema comment for the primary guard).
export function findOverlappingAcceptedBookings(vendorId: string, weddingDate: Date, eventEndDate: Date) {
  return prisma.booking.findMany({
    where: {
      vendorId,
      status: BookingStatus.ACCEPTED,
      weddingDate: { lte: eventEndDate },
      OR: [{ eventEndDate: { gte: weddingDate } }, { eventEndDate: null, weddingDate: { gte: weddingDate } }],
    },
  });
}

export async function nextBookingNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const counter = await tx.bookingCounter.upsert({
    where: { year },
    create: { year, count: 1 },
    update: { count: { increment: 1 } },
  });
  return `BOOK-${year}-${String(counter.count).padStart(6, "0")}`;
}

export function createBooking(tx: Prisma.TransactionClient, data: Prisma.BookingUncheckedCreateInput) {
  return tx.booking.create({ data, include: customerBookingInclude });
}

export function updateBookingStatus(
  tx: Prisma.TransactionClient,
  id: string,
  data: Prisma.BookingUpdateInput,
) {
  return tx.booking.update({ where: { id }, data, include: customerBookingInclude });
}
