import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role } from "@prisma/client";
import {
  createEvent,
  createUserAndLogin,
  createVendorPackage,
  createVendorProfile,
  futureDateString,
  setVendorAvailability,
} from "./helpers";

async function setupBookableVendor(vendorEmail: string) {
  const vendorToken = await createUserAndLogin(Role.VENDOR, vendorEmail);
  const vendor = await createVendorProfile(vendorToken, { businessName: `Vendor ${vendorEmail}` });
  const pkg = await createVendorPackage(vendorToken, { name: "Premium Photography", price: 80000 });
  return { vendorToken, vendor, pkg };
}

describe("Booking creation", () => {
  it("lets a customer create a booking on an available date, snapshotting package details", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-1@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-1@example.test");
    const event = await createEvent(customerToken, { name: "Priya Wedding" });

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date, guestCount: 150 });

    expect(res.status).toBe(201);
    const booking = res.body.data.booking;
    expect(booking.status).toBe("PENDING");
    expect(booking.bookingNumber).toMatch(/^BOOK-\d{4}-\d{6}$/);
    expect(booking.eventNameSnapshot).toBe("Priya Wedding");
    expect(booking.packageNameSnapshot).toBe("Premium Photography");
    expect(booking.packagePriceSnapshot).toBe(80000);
    expect(booking.totalAmount).toBe(80000);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/api/v1/bookings").send({});
    expect(res.status).toBe(401);
  });

  it("rejects booking for another customer's event (IDOR)", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-2@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");

    const ownerToken = await createUserAndLogin(Role.CUSTOMER, "booking-event-owner@example.test");
    const event = await createEvent(ownerToken);

    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "booking-event-attacker@example.test");
    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    expect(res.status).toBe(404);
  });

  it("rejects a package that does not belong to the vendor", async () => {
    const { vendor } = await setupBookableVendor("booking-vendor-3@example.test");
    const { pkg: otherPkg } = await setupBookableVendor("booking-vendor-other@example.test");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-3@example.test");
    const event = await createEvent(customerToken);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: otherPkg.id, weddingDate: futureDateString(30) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PACKAGE_NOT_FOUND");
  });

  it("rejects a non-existent vendor", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-4@example.test");
    const event = await createEvent(customerToken);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        vendorId: "00000000-0000-0000-0000-000000000000",
        eventId: event.id,
        packageId: "00000000-0000-0000-0000-000000000000",
        weddingDate: futureDateString(30),
      });

    expect(res.status).toBe(404);
  });

  it("rejects a date the vendor marked UNAVAILABLE", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-5@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "UNAVAILABLE");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-5@example.test");
    const event = await createEvent(customerToken);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VENDOR_NOT_AVAILABLE");
  });

  it("rejects a date with no availability record at all (unknown != available)", async () => {
    const { vendor, pkg } = await setupBookableVendor("booking-vendor-6@example.test");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-6@example.test");
    const event = await createEvent(customerToken);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: futureDateString(30) });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VENDOR_NOT_AVAILABLE");
  });

  it("rejects a date the vendor BLOCKED", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-7@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "BLOCKED");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-7@example.test");
    const event = await createEvent(customerToken);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    expect(res.status).toBe(409);
  });

  it("validates every day of a multi-day booking is AVAILABLE", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-8@example.test");
    const day1 = futureDateString(30);
    const day2 = futureDateString(31);
    const day3 = futureDateString(32);
    await setVendorAvailability(vendorToken, day1, "AVAILABLE");
    await setVendorAvailability(vendorToken, day2, "AVAILABLE");
    // day3 left unset (unknown)

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-8@example.test");
    const event = await createEvent(customerToken);

    const partial = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: day1, eventEndDate: day3 });
    expect(partial.status).toBe(409);

    await setVendorAvailability(vendorToken, day3, "AVAILABLE");

    const full = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: day1, eventEndDate: day3 });
    expect(full.status).toBe(201);
  });

  it("ignores a client-supplied price and always uses the server-side package price", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-9@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-9@example.test");
    const event = await createEvent(customerToken);

    const res = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        vendorId: vendor.id,
        eventId: event.id,
        packageId: pkg.id,
        weddingDate: date,
        totalAmount: 1, // not part of the schema - must be ignored
      });

    expect(res.status).toBe(201);
    expect(res.body.data.booking.totalAmount).toBe(80000);
  });

  it("generates unique sequential booking numbers under concurrent requests", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-10@example.test");
    const dates = [futureDateString(30), futureDateString(31), futureDateString(32)];
    for (const d of dates) await setVendorAvailability(vendorToken, d, "AVAILABLE");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-10@example.test");
    const events = await Promise.all(dates.map(() => createEvent(customerToken)));

    const results = await Promise.all(
      dates.map((date, i) =>
        request(app)
          .post("/api/v1/bookings")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ vendorId: vendor.id, eventId: events[i].id, packageId: pkg.id, weddingDate: date }),
      ),
    );

    const numbers = results.map((r) => r.body.data.booking.bookingNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

describe("Vendor accept/decline", () => {
  it("lets a vendor accept a pending booking", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-11@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-11@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });
    const bookingId = created.body.data.booking.id;

    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe("ACCEPTED");
  });

  it("lets a vendor decline a pending booking", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-12@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-12@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });
    const bookingId = created.body.data.booking.id;

    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/decline`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ vendorNotes: "Fully booked" });

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe("DECLINED");
  });

  it("prevents a vendor from accepting another vendor's booking (IDOR)", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-13@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-13@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });
    const bookingId = created.body.data.booking.id;

    const { vendorToken: otherVendorToken } = await setupBookableVendor("booking-vendor-14@example.test");
    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${otherVendorToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it("rejects accepting a booking that isn't PENDING (invalid transition)", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-15@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-15@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });
    const bookingId = created.body.data.booking.id;

    await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/decline`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});

    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("rejects accepting a second conflicting booking once the first is accepted", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-16@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");

    const custAToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-16a@example.test");
    const eventA = await createEvent(custAToken);
    const bookingA = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${custAToken}`)
      .send({ vendorId: vendor.id, eventId: eventA.id, packageId: pkg.id, weddingDate: date });

    const custBToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-16b@example.test");
    const eventB = await createEvent(custBToken);
    const bookingB = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${custBToken}`)
      .send({ vendorId: vendor.id, eventId: eventB.id, packageId: pkg.id, weddingDate: date });

    expect(bookingA.status).toBe(201);
    expect(bookingB.status).toBe(201); // both PENDING requests allowed

    const acceptA = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingA.body.data.booking.id}/accept`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});
    expect(acceptA.status).toBe(200);

    const acceptB = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingB.body.data.booking.id}/accept`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});
    expect(acceptB.status).toBe(409);
    expect(acceptB.body.error.code).toBe("VENDOR_NOT_AVAILABLE");
  });
});

describe("Cancellation", () => {
  it("lets a customer cancel their own pending booking", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-17@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-17@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const res = await request(app)
      .patch(`/api/v1/bookings/${created.body.data.booking.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Change of plans" });

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe("CANCELLED");
  });

  it("reopens the vendor's availability when an accepted booking is cancelled", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-18@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-18@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });
    const bookingId = created.body.data.booking.id;

    await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/accept`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});

    await request(app)
      .patch(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});

    const availability = await prisma.vendorAvailability.findFirst({ where: { vendorId: vendor.id } });
    expect(availability?.status).toBe("AVAILABLE");
  });

  it("prevents Customer B from cancelling Customer A's booking (IDOR)", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-19@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-19a@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const otherCustomerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-19b@example.test");
    const res = await request(app)
      .patch(`/api/v1/bookings/${created.body.data.booking.id}/cancel`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({});

    expect(res.status).toBe(404);
  });
});

describe("Booking reads", () => {
  it("prevents Customer A from reading Customer B's booking (IDOR)", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-20@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-20a@example.test");
    const event = await createEvent(customerToken);
    const created = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const otherCustomerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-20b@example.test");
    const res = await request(app)
      .get(`/api/v1/bookings/${created.body.data.booking.id}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);

    expect(res.status).toBe(404);
  });

  it("lets the vendor list and filter their own bookings", async () => {
    const { vendor, pkg, vendorToken } = await setupBookableVendor("booking-vendor-21@example.test");
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "booking-customer-21@example.test");
    const event = await createEvent(customerToken);
    await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const res = await request(app)
      .get("/api/v1/vendors/me/bookings?status=PENDING")
      .set("Authorization", `Bearer ${vendorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });
});
