import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { simulateCheckoutCompletion } from "../src/payments/stubProvider";

export const PASSWORD = "ValidPass123";

export async function createUserAndLogin(role: Role, email: string): Promise<string> {
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.create({
    data: { name: `Test ${role}`, email, passwordHash, role },
  });
  const res = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  return res.body.data.accessToken as string;
}

export async function createCategory(name = "Photography") {
  return prisma.vendorCategory.create({
    data: { name, slug: name.toLowerCase().replace(/\s+/g, "-") },
  });
}

export async function createVendorProfile(
  token: string,
  overrides: Partial<{ businessName: string; city: string; categoryId: string }> = {},
) {
  const res = await request(app)
    .post("/api/v1/vendors/me")
    .set("Authorization", `Bearer ${token}`)
    .send({ businessName: "Test Vendor Co", city: "Mumbai", ...overrides });
  return res.body.data.vendor;
}

// Always a future YYYY-MM-DD date relative to whenever the suite runs, so
// tests never start failing once a hardcoded date becomes "the past".
export function futureDateString(daysFromNow: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow));
  return date.toISOString().slice(0, 10);
}

export async function createEvent(token: string, overrides: Partial<{ name: string; city: string; weddingDate: string }> = {}) {
  const res = await request(app)
    .post("/api/v1/events")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Wedding", city: "Mumbai", weddingDate: futureDateString(60), ...overrides });
  return res.body.data.event;
}

export async function createVendorPackage(
  token: string,
  overrides: Partial<{ name: string; price: number; advancePercentage: number }> = {},
) {
  const res = await request(app)
    .post("/api/v1/vendors/me/packages")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Package", price: 50000, ...overrides });
  return res.body.data.package;
}

export async function setVendorAvailability(token: string, date: string, status: "AVAILABLE" | "UNAVAILABLE" | "BLOCKED") {
  await request(app)
    .post("/api/v1/vendors/me/availability")
    .set("Authorization", `Bearer ${token}`)
    .send({ date, status });
}

// Builds a fully ACCEPTED booking (vendor + package + availability +
// booking + accept) in one call, since most payment tests need one as
// their starting point rather than the booking flow itself.
export async function setupAcceptedBooking(
  suffix: string,
  overrides: Partial<{ price: number; advancePercentage: number }> = {},
) {
  const vendorToken = await createUserAndLogin(Role.VENDOR, `payment-vendor-${suffix}@example.test`);
  const vendor = await createVendorProfile(vendorToken, { businessName: `Payment Vendor ${suffix}` });
  const pkg = await createVendorPackage(vendorToken, {
    name: "Payment Test Package",
    price: overrides.price ?? 50000,
    advancePercentage: overrides.advancePercentage ?? 20,
  });

  const date = futureDateString(30);
  await setVendorAvailability(vendorToken, date, "AVAILABLE");

  const customerToken = await createUserAndLogin(Role.CUSTOMER, `payment-customer-${suffix}@example.test`);
  const event = await createEvent(customerToken);

  const bookingRes = await request(app)
    .post("/api/v1/bookings")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date, guestCount: 100 });
  const bookingId = bookingRes.body.data.booking.id as string;

  await request(app)
    .patch(`/api/v1/vendors/me/bookings/${bookingId}/accept`)
    .set("Authorization", `Bearer ${vendorToken}`)
    .send({});

  return { vendorToken, vendor, pkg, customerToken, event, bookingId };
}

// Builds on setupAcceptedBooking, then drives it all the way to CONFIRMED
// via a real (stub-provider) advance payment capture - order creation,
// simulated checkout, and backend verification - the same code path a real
// customer payment would exercise. Used by tests that need a genuinely
// CONFIRMED booking (e.g. to test booking.service.completeBooking's own
// transition/date guards), as opposed to setupCompletedBooking below, which
// skips straight to COMPLETED for tests that only care about review logic.
export async function setupConfirmedBooking(
  suffix: string,
  overrides: Partial<{ price: number; advancePercentage: number }> = {},
) {
  const result = await setupAcceptedBooking(suffix, overrides);
  const orderRes = await request(app)
    .post(`/api/v1/bookings/${result.bookingId}/payment/order`)
    .set("Authorization", `Bearer ${result.customerToken}`)
    .send({});
  const { providerOrderId } = orderRes.body.data.order;
  const completion = simulateCheckoutCompletion(providerOrderId, "success");
  await request(app)
    .post("/api/v1/payments/verify")
    .set("Authorization", `Bearer ${result.customerToken}`)
    .send(completion);
  return result;
}

// Builds on setupAcceptedBooking, then jumps straight to COMPLETED via a
// direct DB write (not the real vendor-triggered PATCH .../complete route,
// which requires the event date to have actually passed - createBooking
// itself refuses a past weddingDate, so a real end-to-end flow can't reach
// COMPLETED within a single test run). This is only for tests that need a
// COMPLETED booking as their *starting point* (review eligibility etc.) -
// the completeBooking guard itself is tested separately, against a real
// future-dated ACCEPTED booking.
export async function setupCompletedBooking(
  suffix: string,
  overrides: Partial<{ price: number; advancePercentage: number }> = {},
) {
  const result = await setupAcceptedBooking(suffix, overrides);
  await prisma.booking.update({
    where: { id: result.bookingId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return result;
}
