import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role } from "@prisma/client";
import { buildSimulatedWebhook, simulateCheckoutCompletion } from "../src/payments/stubProvider";
import { computeHmacSignature } from "../src/payments/signature";
import { env } from "../src/config/env";
import {
  createEvent,
  createUserAndLogin,
  createVendorPackage,
  createVendorProfile,
  futureDateString,
  setVendorAvailability,
  setupAcceptedBooking,
} from "./helpers";

async function createOrder(customerToken: string, bookingId: string) {
  const res = await request(app)
    .post(`/api/v1/bookings/${bookingId}/payment/order`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({});
  return res;
}

async function verifyPayment(
  customerToken: string,
  body: { providerOrderId: string; providerPaymentId: string; providerSignature: string },
) {
  return request(app).post("/api/v1/payments/verify").set("Authorization", `Bearer ${customerToken}`).send(body);
}

async function postWebhook(rawBody: string, signature: string) {
  return request(app)
    .post("/api/v1/payments/webhook/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", signature)
    .send(rawBody);
}

// Drives a booking all the way to a CAPTURED advance payment, the same way
// a real customer checkout would (order -> checkout -> verify).
async function captureAdvance(customerToken: string, bookingId: string) {
  const orderRes = await createOrder(customerToken, bookingId);
  const { providerOrderId } = orderRes.body.data.order;
  const completion = simulateCheckoutCompletion(providerOrderId, "success");
  const verifyRes = await verifyPayment(customerToken, completion);
  return { orderRes, completion, verifyRes };
}

describe("Payment order creation", () => {
  it("creates an order for an ACCEPTED booking, amount taken from the booking's snapshotted advance", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("order-1", { price: 50000, advancePercentage: 20 });

    const res = await createOrder(customerToken, bookingId);

    expect(res.status).toBe(201);
    expect(res.body.data.order.amount).toBe(10000);
    expect(res.body.data.order.currency).toBe("INR");
    expect(res.body.data.order.providerOrderId).toBeTruthy();
    expect(res.body.data.order.razorpayKeyId).toBe("rzp_test_stub_dev_only");
    // Never a real secret in any response, ever.
    expect(JSON.stringify(res.body)).not.toContain("KEY_SECRET");
    expect(JSON.stringify(res.body)).not.toContain("stub-secret");
  });

  it("ignores any amount the client tries to send - amount always comes from the booking", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("order-amount-tamper", {
      price: 50000,
      advancePercentage: 20,
    });

    const res = await request(app)
      .post(`/api/v1/bookings/${bookingId}/payment/order`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ amount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.order.amount).toBe(10000);
  });

  it("reuses the same active order on a second call instead of creating a duplicate", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("order-2");

    const first = await createOrder(customerToken, bookingId);
    const second = await createOrder(customerToken, bookingId);

    expect(first.body.data.order.paymentId).toBe(second.body.data.order.paymentId);
    expect(first.body.data.order.providerOrderId).toBe(second.body.data.order.providerOrderId);

    const count = await prisma.payment.count({ where: { bookingId } });
    expect(count).toBe(1);
  });

  it("rejects payment for a booking that isn't ACCEPTED yet", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "order-pending-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Pending Vendor" });
    const pkg = await createVendorPackage(vendorToken, { price: 50000 });
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");

    const customerToken = await createUserAndLogin(Role.CUSTOMER, "order-pending-customer@example.test");
    const event = await createEvent(customerToken);
    const bookingRes = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });
    const bookingId = bookingRes.body.data.booking.id;

    const res = await createOrder(customerToken, bookingId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PAYMENT_NOT_APPLICABLE");
  });

  it("rejects payment when the package requires no advance (0%)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("order-zero-advance", {
      price: 50000,
      advancePercentage: 0,
    });

    const res = await createOrder(customerToken, bookingId);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PAYMENT_NOT_REQUIRED");
  });

  it("rejects an unauthenticated request", async () => {
    const { bookingId } = await setupAcceptedBooking("order-unauth");
    const res = await request(app).post(`/api/v1/bookings/${bookingId}/payment/order`).send({});
    expect(res.status).toBe(401);
  });

  it("rejects a request for another customer's booking (IDOR)", async () => {
    const { bookingId } = await setupAcceptedBooking("order-idor");
    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "order-idor-attacker@example.test");

    const res = await createOrder(attackerToken, bookingId);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BOOKING_NOT_FOUND");
  });
});

describe("Payment verification", () => {
  it("captures a valid payment and confirms the booking with the correct commission", async () => {
    const { customerToken, bookingId, vendorToken } = await setupAcceptedBooking("verify-1", {
      price: 50000,
      advancePercentage: 20,
    });

    const { verifyRes } = await captureAdvance(customerToken, bookingId);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.payment.status).toBe("CAPTURED");
    expect(verifyRes.body.data.payment).not.toHaveProperty("providerSignature");
    expect(verifyRes.body.data.booking.status).toBe("CONFIRMED");
    expect(verifyRes.body.data.booking.paymentStatus).toBe("PAID");
    expect(verifyRes.body.data.booking.advancePaidAmount).toBe(10000);
    expect(verifyRes.body.data.booking.confirmedAt).toBeTruthy();

    const commission = await prisma.commission.findFirst({ where: { bookingId } });
    expect(commission).not.toBeNull();
    expect(commission!.percentage).toBe(10);
    expect(commission!.grossAmount).toBe(10000);
    expect(commission!.commissionAmount).toBe(1000);
    expect(commission!.vendorAmount).toBe(9000);

    // Sanity check nobody else's booking/vendor got touched.
    const vendorBookingCheck = await request(app)
      .get(`/api/v1/vendors/me/bookings/${bookingId}`)
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(vendorBookingCheck.body.data.booking.status).toBe("CONFIRMED");
  });

  it("rejects an invalid signature and marks the payment FAILED without confirming the booking", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("verify-bad-sig");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "failure");

    const res = await verifyPayment(customerToken, completion);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PAYMENT_VERIFICATION_FAILED");

    const payment = await prisma.payment.findUnique({ where: { providerOrderId } });
    expect(payment!.status).toBe("FAILED");
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe("ACCEPTED");
    expect(booking!.paymentStatus).toBe("FAILED");
  });

  it("rejects a signature that doesn't match the amount actually paid (tampered amount)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("verify-amount-mismatch");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "success");

    // Simulate the frontend trying to claim a smaller amount was paid than
    // what was actually captured - the backend re-fetches from the
    // provider and must catch this itself, not trust the client's numbers.
    await prisma.payment.update({ where: { providerOrderId }, data: { amount: 1 } });

    const res = await verifyPayment(customerToken, completion);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PAYMENT_VERIFICATION_FAILED");
  });

  it("is idempotent - verifying an already-captured payment twice does not double-apply it", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("verify-idempotent");
    const { completion } = await captureAdvance(customerToken, bookingId);

    const second = await verifyPayment(customerToken, completion);
    expect(second.status).toBe(200);
    expect(second.body.data.payment.status).toBe("CAPTURED");

    const commissions = await prisma.commission.findMany({ where: { bookingId } });
    expect(commissions).toHaveLength(1);
    const attempts = await prisma.paymentAttempt.findMany({ where: { payment: { bookingId } } });
    expect(attempts.filter((a) => a.status === "CAPTURED")).toHaveLength(1);
  });

  it("rejects verification of another customer's payment (IDOR)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("verify-idor");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "success");

    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "verify-idor-attacker@example.test");
    const res = await verifyPayment(attackerToken, completion);
    expect(res.status).toBe(404);

    // Untouched by the attacker's attempt.
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe("ACCEPTED");
  });

  it("rejects verification of an unknown order id", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "verify-unknown@example.test");
    const res = await verifyPayment(customerToken, {
      providerOrderId: "order_stub_does_not_exist",
      providerPaymentId: "pay_stub_does_not_exist",
      providerSignature: "0".repeat(64),
    });
    expect(res.status).toBe(404);
  });
});

describe("Razorpay webhook", () => {
  it("processes a valid payment.captured webhook and confirms the booking", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("webhook-captured");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "success");
    const { rawBody, signature } = buildSimulatedWebhook(providerOrderId, completion.providerPaymentId, "payment.captured");

    const res = await postWebhook(rawBody, signature);
    expect(res.status).toBe(200);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe("CONFIRMED");
    expect(booking!.paymentStatus).toBe("PAID");
  });

  it("processes a payment.failed webhook without confirming the booking", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("webhook-failed");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "success");
    const { rawBody, signature } = buildSimulatedWebhook(providerOrderId, completion.providerPaymentId, "payment.failed");

    const res = await postWebhook(rawBody, signature);
    expect(res.status).toBe(200);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe("ACCEPTED");
    expect(booking!.paymentStatus).toBe("FAILED");
  });

  it("rejects a webhook with an invalid signature", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("webhook-bad-sig");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "success");
    const { rawBody } = buildSimulatedWebhook(providerOrderId, completion.providerPaymentId, "payment.captured");

    const res = await postWebhook(rawBody, "0".repeat(64));
    expect(res.status).toBe(400);

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.status).toBe("ACCEPTED");
  });

  it("rejects a webhook with no signature header at all", async () => {
    const res = await request(app)
      .post("/api/v1/payments/webhook/razorpay")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ id: "evt_x", event: "payment.captured", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("is idempotent for a redelivered event id - does not reprocess or double-count", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("webhook-idempotent");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const completion = simulateCheckoutCompletion(providerOrderId, "success");
    const { rawBody, signature } = buildSimulatedWebhook(providerOrderId, completion.providerPaymentId, "payment.captured");

    const first = await postWebhook(rawBody, signature);
    const second = await postWebhook(rawBody, signature);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const webhookEvents = await prisma.paymentWebhookEvent.count();
    expect(webhookEvents).toBe(1);
    const commissions = await prisma.commission.count({ where: { bookingId } });
    expect(commissions).toBe(1);
  });

  it("does not resurrect a payment that was already verified as captured via the REST call (race with a late webhook)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("webhook-race");
    const { orderRes, completion } = await captureAdvance(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;
    const { rawBody, signature } = buildSimulatedWebhook(providerOrderId, completion.providerPaymentId, "payment.captured");

    const res = await postWebhook(rawBody, signature);
    expect(res.status).toBe(200);

    const commissions = await prisma.commission.count({ where: { bookingId } });
    expect(commissions).toBe(1);
  });

  it("safely ignores an unrecognized event type", async () => {
    const payload = { id: "evt_stub_other", event: "order.paid", payload: {} };
    const rawBody = JSON.stringify(payload);
    const signature = computeHmacSignature(env.RAZORPAY_WEBHOOK_SECRET, rawBody);

    const res = await postWebhook(rawBody, signature);
    expect(res.status).toBe(200);

    const event = await prisma.paymentWebhookEvent.findFirst({ where: { providerEventId: "evt_stub_other" } });
    expect(event!.status).toBe("IGNORED");
  });
});

describe("Payment reads and visibility", () => {
  it("lets the customer list and fetch their own payment, never including the provider signature", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("read-customer");
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const listRes = await request(app).get("/api/v1/payments").set("Authorization", `Bearer ${customerToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.some((p: { id: string }) => p.id === paymentId)).toBe(true);
    for (const p of listRes.body.data.items) {
      expect(p).not.toHaveProperty("providerSignature");
    }

    const getRes = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.payment).not.toHaveProperty("providerSignature");
  });

  it("rejects a customer viewing another customer's payment (IDOR)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("read-idor");
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "read-idor-attacker@example.test");
    const res = await request(app).get(`/api/v1/payments/${paymentId}`).set("Authorization", `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);
  });

  it("lets the owning vendor see the payment but not an unrelated vendor", async () => {
    const { customerToken, bookingId, vendorToken } = await setupAcceptedBooking("read-vendor");
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const ownVendorList = await request(app).get("/api/v1/vendors/me/payments").set("Authorization", `Bearer ${vendorToken}`);
    expect(ownVendorList.status).toBe(200);
    expect(ownVendorList.body.data.items.some((p: { id: string }) => p.id === paymentId)).toBe(true);

    const otherVendorToken = await createUserAndLogin(Role.VENDOR, "read-vendor-other@example.test");
    const otherVendorGet = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set("Authorization", `Bearer ${otherVendorToken}`);
    expect(otherVendorGet.status).toBe(404);
  });

  it("never returns another vendor's payments through the vendor-scoped route", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("read-vendor-list");
    await captureAdvance(customerToken, bookingId);

    const otherVendorToken = await createUserAndLogin(Role.VENDOR, "read-vendor-list-other@example.test");
    await createVendorProfile(otherVendorToken, { businessName: "Unrelated Vendor" });
    const res = await request(app).get("/api/v1/vendors/me/payments").set("Authorization", `Bearer ${otherVendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe("Admin payments and refunds", () => {
  it("lets an admin list all payments with filters", async () => {
    const { customerToken, bookingId, vendor } = await setupAcceptedBooking("admin-list");
    await captureAdvance(customerToken, bookingId);

    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-list-admin@example.test");
    const res = await request(app)
      .get(`/api/v1/admin/payments?vendorId=${vendor.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items.every((p: { vendorId: string }) => p.vendorId === vendor.id)).toBe(true);
  });

  it("rejects a non-admin listing admin payments", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "admin-list-nonadmin@example.test");
    const res = await request(app).get("/api/v1/admin/payments").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("performs a full refund, moving both payment and booking to REFUNDED", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("refund-full", { price: 50000, advancePercentage: 20 });
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const adminToken = await createUserAndLogin(Role.ADMIN, "refund-full-admin@example.test");
    const res = await request(app)
      .post(`/api/v1/admin/payments/${paymentId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.refund.status).toBe("REFUNDED");
    expect(res.body.data.refund.amount).toBe(10000);
    expect(res.body.data.refund).not.toHaveProperty("providerSignature");

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment!.status).toBe("REFUNDED");
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.paymentStatus).toBe("REFUNDED");
    // The booking itself stays CONFIRMED - a refund doesn't unmake the booking.
    expect(booking!.status).toBe("CONFIRMED");
  });

  it("performs a partial refund and leaves the booking's paymentStatus as PAID (not REFUNDED)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("refund-partial", { price: 50000, advancePercentage: 20 });
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const adminToken = await createUserAndLogin(Role.ADMIN, "refund-partial-admin@example.test");
    const res = await request(app)
      .post(`/api/v1/admin/payments/${paymentId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 4000 });

    expect(res.status).toBe(201);
    expect(res.body.data.refund.status).toBe("PARTIALLY_REFUNDED");

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment!.status).toBe("PARTIALLY_REFUNDED");
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(booking!.paymentStatus).toBe("PAID");
  });

  it("rejects a refund larger than what remains unrefunded", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("refund-over", { price: 50000, advancePercentage: 20 });
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const adminToken = await createUserAndLogin(Role.ADMIN, "refund-over-admin@example.test");
    const res = await request(app)
      .post(`/api/v1/admin/payments/${paymentId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 999999 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REFUND_AMOUNT");
  });

  it("rejects refunding a payment that was never captured", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("refund-not-captured");
    const orderRes = await createOrder(customerToken, bookingId);
    const paymentId = orderRes.body.data.order.paymentId;

    const adminToken = await createUserAndLogin(Role.ADMIN, "refund-not-captured-admin@example.test");
    const res = await request(app)
      .post(`/api/v1/admin/payments/${paymentId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PAYMENT_NOT_REFUNDABLE");
  });

  it("rejects a non-admin trying to issue a refund", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("refund-nonadmin");
    const { verifyRes } = await captureAdvance(customerToken, bookingId);
    const paymentId = verifyRes.body.data.payment.id;

    const res = await request(app)
      .post(`/api/v1/admin/payments/${paymentId}/refund`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe("Dev-only payment simulation endpoints", () => {
  it("are reachable in the test environment (stub provider active)", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("dev-routes");
    const orderRes = await createOrder(customerToken, bookingId);
    const { providerOrderId } = orderRes.body.data.order;

    const res = await request(app)
      .post("/api/v1/dev/payments/simulate-checkout")
      .send({ providerOrderId, outcome: "success" });
    expect(res.status).toBe(200);
    expect(res.body.data.providerPaymentId).toBeTruthy();
    expect(res.body.data.providerSignature).toBeTruthy();
  });
});
