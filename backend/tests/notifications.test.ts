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
  setupAcceptedBooking,
  setupCompletedBooking,
  setupConfirmedBooking,
} from "./helpers";

async function listNotifications(token: string, query = "") {
  return request(app).get(`/api/v1/notifications${query}`).set("Authorization", `Bearer ${token}`);
}

describe("Booking notifications", () => {
  it("notifies the vendor when a booking is created, not the customer", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "notif-created-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Notif Vendor" });
    const pkg = await createVendorPackage(vendorToken, { price: 30000 });
    const date = futureDateString(20);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "notif-created-customer@example.test");
    const event = await createEvent(customerToken);

    await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const vendorNotifs = await listNotifications(vendorToken);
    expect(vendorNotifs.body.data.items.some((n: { type: string }) => n.type === "BOOKING_CREATED")).toBe(true);

    const customerNotifs = await listNotifications(customerToken);
    expect(customerNotifs.body.data.items.some((n: { type: string }) => n.type === "BOOKING_CREATED")).toBe(false);
  });

  it("notifies the customer when a booking is accepted", async () => {
    const { customerToken } = await setupAcceptedBooking("notif-accepted");
    const res = await listNotifications(customerToken);
    expect(res.body.data.items.some((n: { type: string }) => n.type === "BOOKING_ACCEPTED")).toBe(true);
  });

  it("notifies only the non-cancelling party when a booking is cancelled", async () => {
    const { customerToken, vendorToken, bookingId } = await setupAcceptedBooking("notif-cancelled");
    await request(app)
      .patch(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});

    const vendorNotifs = await listNotifications(vendorToken);
    expect(vendorNotifs.body.data.items.some((n: { type: string }) => n.type === "BOOKING_CANCELLED")).toBe(true);

    // The customer cancelled it themselves - no self-notification.
    const customerNotifs = await listNotifications(customerToken);
    expect(customerNotifs.body.data.items.some((n: { type: string }) => n.type === "BOOKING_CANCELLED")).toBe(false);
  });

  it("notifies the customer when a booking is completed", async () => {
    const { customerToken, vendorToken, bookingId } = await setupConfirmedBooking("notif-completed");
    // Force the event date into the past so the real completeBooking route
    // can succeed (createBooking itself refuses a past date, so this is
    // written directly, same pattern as tests/helpers.setupCompletedBooking).
    await prisma.booking.update({ where: { id: bookingId }, data: { weddingDate: new Date("2000-01-01") } });

    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/complete`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});
    expect(res.status).toBe(200);

    const customerNotifs = await listNotifications(customerToken);
    expect(customerNotifs.body.data.items.some((n: { type: string }) => n.type === "BOOKING_COMPLETED")).toBe(true);
  });
});

describe("Message notifications", () => {
  it("notifies the recipient, never the sender", async () => {
    const { customerToken, vendorToken, vendor } = await setupAcceptedBooking("notif-message");
    const convoRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id });
    const conversationId = convoRes.body.data.conversation.id;

    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Hello, looking forward to working with you!" });

    const vendorNotifs = await listNotifications(vendorToken);
    expect(vendorNotifs.body.data.items.some((n: { type: string }) => n.type === "NEW_MESSAGE")).toBe(true);

    const customerNotifs = await listNotifications(customerToken);
    expect(customerNotifs.body.data.items.some((n: { type: string }) => n.type === "NEW_MESSAGE")).toBe(false);
  });
});

describe("Review notifications", () => {
  it("notifies the vendor when a review is submitted, and the customer when it's published/rejected", async () => {
    const { customerToken, vendorToken, bookingId } = await setupCompletedBooking("notif-review");
    const created = await request(app)
      .post(`/api/v1/bookings/${bookingId}/review`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5, comment: "Wonderful experience overall, thank you so much!" });

    const vendorNotifs = await listNotifications(vendorToken);
    expect(vendorNotifs.body.data.items.some((n: { type: string }) => n.type === "REVIEW_RECEIVED")).toBe(true);

    const adminToken = await createUserAndLogin(Role.ADMIN, "notif-review-admin@example.test");
    await request(app)
      .patch(`/api/v1/admin/reviews/${created.body.data.review.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PUBLISHED" });

    const customerNotifs = await listNotifications(customerToken);
    expect(customerNotifs.body.data.items.some((n: { type: string }) => n.type === "REVIEW_PUBLISHED")).toBe(true);
  });
});

describe("Vendor admin action notifications", () => {
  it("notifies the vendor on verification and activation changes", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "notif-vendor-admin@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Notif Admin Vendor" });
    const adminToken = await createUserAndLogin(Role.ADMIN, "notif-vendor-admin-admin@example.test");

    await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verificationStatus: "VERIFIED" });
    await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    const vendorNotifs = await listNotifications(vendorToken);
    const types = vendorNotifs.body.data.items.map((n: { type: string }) => n.type);
    expect(types).toContain("VENDOR_VERIFIED");
    expect(types).toContain("VENDOR_DEACTIVATED");
  });
});

describe("Notification center API", () => {
  it("tracks unread count and supports mark-as-read", async () => {
    const { customerToken } = await setupAcceptedBooking("notif-center-1");

    const before = await request(app).get("/api/v1/notifications/unread-count").set("Authorization", `Bearer ${customerToken}`);
    expect(before.body.data.count).toBeGreaterThan(0);

    const list = await listNotifications(customerToken);
    const id = list.body.data.items[0].id;

    const markRes = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.notification.isRead).toBe(true);

    const after = await request(app).get("/api/v1/notifications/unread-count").set("Authorization", `Bearer ${customerToken}`);
    expect(after.body.data.count).toBe(before.body.data.count - 1);
  });

  it("supports mark-all-read", async () => {
    const { customerToken } = await setupAcceptedBooking("notif-center-2");
    const markAllRes = await request(app).patch("/api/v1/notifications/read-all").set("Authorization", `Bearer ${customerToken}`);
    expect(markAllRes.status).toBe(200);

    const after = await request(app).get("/api/v1/notifications/unread-count").set("Authorization", `Bearer ${customerToken}`);
    expect(after.body.data.count).toBe(0);
  });

  it("filters to unread only", async () => {
    const { customerToken } = await setupAcceptedBooking("notif-center-3");
    const list = await listNotifications(customerToken);
    const id = list.body.data.items[0].id;
    await request(app).patch(`/api/v1/notifications/${id}/read`).set("Authorization", `Bearer ${customerToken}`);

    const unreadOnly = await listNotifications(customerToken, "?unreadOnly=true");
    expect(unreadOnly.body.data.items.every((n: { isRead: boolean }) => !n.isRead)).toBe(true);
    expect(unreadOnly.body.data.items.some((n: { id: string }) => n.id === id)).toBe(false);
  });

  it("lets a customer delete their own notification", async () => {
    const { customerToken } = await setupAcceptedBooking("notif-center-delete");
    const list = await listNotifications(customerToken);
    const id = list.body.data.items[0].id;

    const res = await request(app).delete(`/api/v1/notifications/${id}`).set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(204);

    const check = await prisma.notification.findUnique({ where: { id } });
    expect(check).toBeNull();
  });

  it("rejects reading/marking/deleting another user's notification (IDOR)", async () => {
    const { customerToken } = await setupAcceptedBooking("notif-idor");
    const list = await listNotifications(customerToken);
    const id = list.body.data.items[0].id;

    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "notif-idor-attacker@example.test");
    const markRes = await request(app).patch(`/api/v1/notifications/${id}/read`).set("Authorization", `Bearer ${attackerToken}`);
    expect(markRes.status).toBe(404);

    const deleteRes = await request(app).delete(`/api/v1/notifications/${id}`).set("Authorization", `Bearer ${attackerToken}`);
    expect(deleteRes.status).toBe(404);

    const attackerList = await listNotifications(attackerToken);
    expect(attackerList.body.data.items.some((n: { id: string }) => n.id === id)).toBe(false);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/notifications");
    expect(res.status).toBe(401);
  });
});
