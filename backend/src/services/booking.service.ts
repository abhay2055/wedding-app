import {
  AvailabilityStatus,
  Booking,
  BookingPaymentStatus,
  BookingStatus,
  Prisma,
  Role,
  VerificationStatus,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { enumerateDatesInclusive, parseDateOnly, todayUTC } from "../utils/dateOnly";
import * as vendorRepository from "../repositories/vendor.repository";
import * as bookingRepository from "../repositories/booking.repository";
import {
  AdminBookingListQuery,
  BookingListQuery,
  CreateBookingInput,
} from "../validators/booking.validator";
import * as notificationService from "./notification.service";

// PENDING/ACCEPTED/DECLINED/CANCELLED transitions are Phase 4. Phase 5 adds
// ACCEPTED -> CONFIRMED, reachable *only* from confirmBookingAfterPayment
// below (never from acceptBooking/declineBooking/cancelBooking, and never
// from any request body a client controls) - see the BookingStatus enum
// comment in schema.prisma. PAYMENT_PENDING/COMPLETED still have no path
// into them.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: [BookingStatus.ACCEPTED, BookingStatus.DECLINED, BookingStatus.CANCELLED],
  ACCEPTED: [BookingStatus.CANCELLED, BookingStatus.CONFIRMED],
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
  PAYMENT_PENDING: [],
  CONFIRMED: [BookingStatus.COMPLETED],
};

function assertTransition(current: BookingStatus, target: BookingStatus): void {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw ApiError.conflict(
      `Cannot move a booking from ${current} to ${target}`,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

async function requireVendorForUser(userId: string) {
  const vendor = await vendorRepository.findVendorByUserId(userId);
  if (!vendor) {
    throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
  }
  return vendor;
}

// --- Create (customer) ---

export async function createBooking(customerId: string, input: CreateBookingInput): Promise<Booking> {
  const weddingDate = parseDateOnly(input.weddingDate)!;
  const eventEndDate = input.eventEndDate ? parseDateOnly(input.eventEndDate)! : null;

  if (weddingDate.getTime() < todayUTC().getTime()) {
    throw ApiError.badRequest("Wedding date cannot be in the past", "PAST_DATE_NOT_ALLOWED");
  }

  const requiredDates = enumerateDatesInclusive(weddingDate, eventEndDate ?? weddingDate);

  // Everything - existence/ownership/eligibility checks, the availability
  // re-check, and the insert - happens inside one transaction, per the
  // spec's "re-check availability inside the booking transaction". A
  // PENDING booking doesn't itself claim the dates (only acceptBooking's
  // conditional AVAILABLE->BOOKED flip does that), so this transaction is
  // about correctness/consistency of the snapshot, not about winning a race
  // - the race is won entirely at accept time.
  const booking = await prisma.$transaction(async (tx) => {
    const event = await tx.weddingEvent.findUnique({ where: { id: input.eventId } });
    if (!event || event.userId !== customerId) {
      throw ApiError.notFound("Wedding event not found", "EVENT_NOT_FOUND");
    }

    const vendor = await tx.vendor.findUnique({ where: { id: input.vendorId } });
    if (!vendor || !vendor.isActive || vendor.verificationStatus === VerificationStatus.REJECTED) {
      throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
    }

    const pkg = await tx.vendorPackage.findUnique({ where: { id: input.packageId } });
    if (!pkg || pkg.vendorId !== vendor.id || !pkg.isActive) {
      throw ApiError.badRequest("Package not found for this vendor", "PACKAGE_NOT_FOUND");
    }

    const availabilityRecords = await tx.vendorAvailability.findMany({
      where: { vendorId: vendor.id, date: { in: requiredDates } },
    });
    const statusByDate = new Map(availabilityRecords.map((r) => [r.date.getTime(), r.status]));
    const allAvailable = requiredDates.every((d) => statusByDate.get(d.getTime()) === AvailabilityStatus.AVAILABLE);
    if (!allAvailable) {
      throw ApiError.conflict("Vendor is no longer available for one or more selected dates.", "VENDOR_NOT_AVAILABLE");
    }

    // Defense in depth: availability already reflects any accepted booking
    // (its dates are flipped to BOOKED at accept time, which would already
    // have failed the check above), but this makes the invariant explicit.
    const overlapping = await tx.booking.findMany({
      where: {
        vendorId: vendor.id,
        status: BookingStatus.ACCEPTED,
        weddingDate: { lte: requiredDates[requiredDates.length - 1] },
        OR: [{ eventEndDate: { gte: weddingDate } }, { eventEndDate: null, weddingDate: { gte: weddingDate } }],
      },
    });
    if (overlapping.length > 0) {
      throw ApiError.conflict("Vendor is no longer available for one or more selected dates.", "VENDOR_NOT_AVAILABLE");
    }

    const creationYear = new Date().getUTCFullYear();
    const bookingNumber = await bookingRepository.nextBookingNumber(tx, creationYear);

    // Snapshotted from the package's advancePercentage at creation time
    // (see the VendorPackage.advancePercentage schema comment) - a vendor
    // changing their package's advance percentage later never changes what
    // an already-created booking owes. 0% means no advance is required at
    // all (advanceAmount stays 0, and payment.service.createPaymentOrder
    // rejects payment for such a booking as PAYMENT_NOT_REQUIRED).
    const advanceAmount = Math.round((pkg.price * pkg.advancePercentage) / 100);

    return bookingRepository.createBooking(tx, {
      bookingNumber,
      customerId,
      vendorId: vendor.id,
      eventId: event.id,
      packageId: pkg.id,
      eventNameSnapshot: event.name,
      packageNameSnapshot: pkg.name,
      packageDescriptionSnapshot: pkg.description,
      packagePriceSnapshot: pkg.price,
      weddingDate,
      eventEndDate,
      guestCount: input.guestCount ?? event.guestCount ?? undefined,
      // Server-controlled - the request body has no `totalAmount` field at
      // all, so there is nothing for a client to override here.
      totalAmount: pkg.price,
      advanceAmount,
      paymentStatus: advanceAmount > 0 ? "PENDING" : "NOT_REQUIRED",
      customerNotes: input.customerNotes,
      status: BookingStatus.PENDING,
    });
  });

  await notificationService.notifyBookingCreated(booking);
  return booking;
}

// --- Customer reads ---

export async function listMyBookingsAsCustomer(customerId: string, query: BookingListQuery) {
  const { items, total } = await bookingRepository.findBookingsByCustomer(customerId, query);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function getMyBookingAsCustomer(customerId: string, bookingId: string) {
  const booking = await bookingRepository.findBookingByIdForCustomer(bookingId);
  if (!booking || booking.customerId !== customerId) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }
  return booking;
}

// --- Vendor reads ---

export async function listMyBookingsAsVendor(vendorUserId: string, query: BookingListQuery) {
  const vendor = await requireVendorForUser(vendorUserId);
  const { items, total } = await bookingRepository.findBookingsByVendor(vendor.id, query);
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}

export async function getMyBookingAsVendor(vendorUserId: string, bookingId: string) {
  const vendor = await requireVendorForUser(vendorUserId);
  const booking = await bookingRepository.findBookingByIdForVendor(bookingId);
  if (!booking || booking.vendorId !== vendor.id) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }
  return booking;
}

// --- Vendor actions ---

export async function acceptBooking(vendorUserId: string, bookingId: string, vendorNotes?: string) {
  const vendor = await requireVendorForUser(vendorUserId);

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.vendorId !== vendor.id) {
      throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
    }
    assertTransition(booking.status, BookingStatus.ACCEPTED);

    const requiredDates = enumerateDatesInclusive(booking.weddingDate, booking.eventEndDate ?? booking.weddingDate);

    // The double-booking guard: only actually claims the dates if every one
    // of them is still AVAILABLE right now, atomically, inside this
    // transaction - see the schema comment on Booking/VendorAvailability.
    const flip = await tx.vendorAvailability.updateMany({
      where: { vendorId: vendor.id, date: { in: requiredDates }, status: AvailabilityStatus.AVAILABLE },
      data: { status: AvailabilityStatus.BOOKED },
    });
    if (flip.count !== requiredDates.length) {
      throw ApiError.conflict("These dates are no longer available.", "VENDOR_NOT_AVAILABLE");
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.ACCEPTED,
        acceptedAt: new Date(),
        vendorNotes: vendorNotes ?? booking.vendorNotes,
      },
    });
  });

  const updated = await bookingRepository.findBookingByIdForVendor(bookingId);
  await notificationService.notifyBookingAccepted(updated!);
  return updated!;
}

export async function declineBooking(vendorUserId: string, bookingId: string, vendorNotes?: string) {
  const vendor = await requireVendorForUser(vendorUserId);
  const booking = await bookingRepository.findBookingById(bookingId);
  if (!booking || booking.vendorId !== vendor.id) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }
  assertTransition(booking.status, BookingStatus.DECLINED);

  // Nothing to undo in VendorAvailability - a PENDING booking never claimed
  // any dates in the first place (only acceptBooking does that).
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.DECLINED, declinedAt: new Date(), vendorNotes: vendorNotes ?? booking.vendorNotes },
  });

  const updated = await bookingRepository.findBookingByIdForVendor(bookingId);
  await notificationService.notifyBookingDeclined(updated!);
  return updated!;
}

// Vendor-triggered, only once the event date has passed - marking a
// booking COMPLETED before the event has even happened would be faking a
// delivered service (and, via Review's COMPLETED-booking eligibility rule,
// would let a review be left before anything was actually delivered).
export async function completeBooking(vendorUserId: string, bookingId: string) {
  const vendor = await requireVendorForUser(vendorUserId);
  const booking = await bookingRepository.findBookingById(bookingId);
  if (!booking || booking.vendorId !== vendor.id) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }
  assertTransition(booking.status, BookingStatus.COMPLETED);

  const eventEndOrWeddingDate = booking.eventEndDate ?? booking.weddingDate;
  if (eventEndOrWeddingDate.getTime() > todayUTC().getTime()) {
    throw ApiError.conflict(
      "This booking can only be marked completed once its event date has passed.",
      "EVENT_NOT_YET_OCCURRED",
    );
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
  });

  const updated = await bookingRepository.findBookingByIdForVendor(bookingId);
  await notificationService.notifyBookingCompleted(updated!);
  return updated!;
}

// --- Cancel (either party) ---

export async function cancelBooking(userId: string, role: Role, bookingId: string, reason?: string) {
  const booking = await bookingRepository.findBookingById(bookingId);
  if (!booking) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }

  let isOwner = role === Role.CUSTOMER && booking.customerId === userId;
  if (!isOwner && role === Role.VENDOR) {
    const vendor = await vendorRepository.findVendorByUserId(userId);
    isOwner = Boolean(vendor && vendor.id === booking.vendorId);
  }
  if (!isOwner) {
    throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
  }

  assertTransition(booking.status, BookingStatus.CANCELLED);

  await prisma.$transaction(async (tx) => {
    if (booking.status === BookingStatus.ACCEPTED) {
      // Cancelling an accepted booking re-opens the vendor's calendar for
      // those dates - only ever AVAILABLE->BOOKED->AVAILABLE, never
      // touching a date the vendor independently marked some other way in
      // the meantime (the WHERE clause only matches rows still BOOKED).
      const requiredDates = enumerateDatesInclusive(booking.weddingDate, booking.eventEndDate ?? booking.weddingDate);
      await tx.vendorAvailability.updateMany({
        where: { vendorId: booking.vendorId, date: { in: requiredDates }, status: AvailabilityStatus.BOOKED },
        data: { status: AvailabilityStatus.AVAILABLE },
      });
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(role === Role.CUSTOMER
          ? { customerNotes: reason ?? booking.customerNotes }
          : { vendorNotes: reason ?? booking.vendorNotes }),
      },
    });
  });

  const updated =
    role === Role.CUSTOMER
      ? await bookingRepository.findBookingByIdForCustomer(bookingId)
      : await bookingRepository.findBookingByIdForVendor(bookingId);
  await notificationService.notifyBookingCancelled(updated!, userId);
  return updated!;
}

// --- Payment integration (Phase 5) ---

// Called only from payment.service.applyPaymentOutcome, inside the same
// transaction that marks a Payment CAPTURED - never reachable from any
// route directly, so a booking can only ever become CONFIRMED as a side
// effect of a verified, captured advance payment (never a frontend
// callback, never just because an order was created).
export async function confirmBookingAfterPayment(
  tx: Prisma.TransactionClient,
  bookingId: string,
  advancePaidAmount: number,
): Promise<Booking> {
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  assertTransition(booking.status, BookingStatus.CONFIRMED);

  return tx.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CONFIRMED,
      confirmedAt: new Date(),
      advancePaidAmount,
      paymentStatus: BookingPaymentStatus.PAID,
    },
  });
}

// Records a failed/other payment outcome on the booking's aggregate
// `paymentStatus` without touching `status` - a failed payment attempt
// never moves the booking out of ACCEPTED (see the Phase 5 spec's explicit
// "do not cancel automatically" rule).
export async function recordBookingPaymentStatus(
  tx: Prisma.TransactionClient,
  bookingId: string,
  paymentStatus: BookingPaymentStatus,
): Promise<void> {
  await tx.booking.update({ where: { id: bookingId }, data: { paymentStatus } });
}

// --- Admin (read-only for Phase 4) ---

export async function listBookingsForAdmin(query: AdminBookingListQuery) {
  const { items, total } = await bookingRepository.findBookingsForAdmin({
    status: query.status,
    vendorId: query.vendorId,
    customerId: query.customerId,
    from: query.from ? parseDateOnly(query.from)! : undefined,
    to: query.to ? parseDateOnly(query.to)! : undefined,
    page: query.page,
    limit: query.limit,
  });
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
  };
}
