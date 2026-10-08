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

async function createReview(customerToken: string, bookingId: string, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/v1/bookings/${bookingId}/review`)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ rating: 5, comment: "Absolutely fantastic service, highly recommended!", ...body });
}

describe("Review creation", () => {
  it("lets an eligible customer review a COMPLETED booking", async () => {
    const { customerToken, bookingId, vendor } = await setupCompletedBooking("review-1");

    const res = await createReview(customerToken, bookingId, { rating: 5, title: "Loved it", comment: "Everything was perfect from start to finish." });

    expect(res.status).toBe(201);
    expect(res.body.data.review.status).toBe("PENDING");
    expect(res.body.data.review.rating).toBe(5);
    expect(res.body.data.review.vendorId).toBe(vendor.id);

    // PENDING reviews never affect the public rating aggregate.
    const vendorRow = await prisma.vendor.findUnique({ where: { id: vendor.id } });
    expect(vendorRow!.reviewCount).toBe(0);
    expect(vendorRow!.averageRating).toBe(0);
  });

  it("rejects a review for a PENDING booking (never even reached ACCEPTED)", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "review-pending-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Pending Vendor" });
    const pkg = await createVendorPackage(vendorToken, { price: 50000 });
    const date = futureDateString(30);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "review-pending-customer@example.test");
    const event = await createEvent(customerToken);
    const bookingRes = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const res = await createReview(customerToken, bookingRes.body.data.booking.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_NOT_COMPLETED");
  });

  it("rejects a review for an ACCEPTED (not yet COMPLETED) booking", async () => {
    const { customerToken, bookingId } = await setupAcceptedBooking("review-accepted");
    const res = await createReview(customerToken, bookingId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("BOOKING_NOT_COMPLETED");
  });

  it("rejects an unrelated customer reviewing someone else's booking (IDOR)", async () => {
    const { bookingId } = await setupCompletedBooking("review-idor");
    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "review-idor-attacker@example.test");
    const res = await createReview(attackerToken, bookingId);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("BOOKING_NOT_FOUND");
  });

  it("rejects a duplicate review for the same booking", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-duplicate");
    const first = await createReview(customerToken, bookingId);
    expect(first.status).toBe(201);

    const second = await createReview(customerToken, bookingId);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("REVIEW_ALREADY_EXISTS");
  });

  it("rejects an out-of-range rating", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-bad-rating");
    const res = await createReview(customerToken, bookingId, { rating: 6 });
    expect(res.status).toBe(400);
  });

  it("rejects a comment that's too short", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-short-comment");
    const res = await createReview(customerToken, bookingId, { comment: "bad" });
    expect(res.status).toBe(400);
  });

  it("strips HTML tags from title/comment (stored-XSS defense)", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-xss");
    const res = await createReview(customerToken, bookingId, {
      title: "<script>alert(1)</script>Great!",
      comment: "<img src=x onerror=alert(1)>Wonderful service all around, would book again.",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.review.title).not.toContain("<script>");
    expect(res.body.data.review.comment).not.toContain("<img");
  });
});

describe("Review reads, editing and deletion", () => {
  it("lets the owning customer edit their PENDING review, resetting it to PENDING", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-edit");
    const created = await createReview(customerToken, bookingId, { rating: 3, comment: "It was okay, nothing special." });
    const id = created.body.data.review.id;

    const res = await request(app)
      .patch(`/api/v1/reviews/${id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rating: 5, comment: "Actually, on reflection this was excellent!" });

    expect(res.status).toBe(200);
    expect(res.body.data.review.rating).toBe(5);
    expect(res.body.data.review.status).toBe("PENDING");
  });

  it("rejects another customer editing someone else's review (IDOR)", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-edit-idor");
    const created = await createReview(customerToken, bookingId);
    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "review-edit-idor-attacker@example.test");

    const res = await request(app)
      .patch(`/api/v1/reviews/${created.body.data.review.id}`)
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ rating: 1 });
    expect(res.status).toBe(404);
  });

  it("rejects a vendor trying to modify a customer's review", async () => {
    const { customerToken, bookingId, vendorToken } = await setupCompletedBooking("review-vendor-cannot-edit");
    const created = await createReview(customerToken, bookingId);

    const res = await request(app)
      .patch(`/api/v1/reviews/${created.body.data.review.id}`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ rating: 1 });
    expect(res.status).toBe(403);
  });

  it("lets the owning customer delete their own review", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-delete");
    const created = await createReview(customerToken, bookingId);

    const res = await request(app)
      .delete(`/api/v1/reviews/${created.body.data.review.id}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(204);

    const check = await prisma.review.findUnique({ where: { id: created.body.data.review.id } });
    expect(check).toBeNull();
  });

  it("rejects another customer deleting someone else's review (IDOR)", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("review-delete-idor");
    const created = await createReview(customerToken, bookingId);
    const attackerToken = await createUserAndLogin(Role.CUSTOMER, "review-delete-idor-attacker@example.test");

    const res = await request(app)
      .delete(`/api/v1/reviews/${created.body.data.review.id}`)
      .set("Authorization", `Bearer ${attackerToken}`);
    expect(res.status).toBe(404);
  });
});

describe("Vendor rating aggregation", () => {
  it("only counts PUBLISHED reviews toward the vendor's public rating", async () => {
    const { customerToken, bookingId, vendor } = await setupCompletedBooking("rating-agg-1", { price: 50000 });
    const created = await createReview(customerToken, bookingId, { rating: 4 });
    const reviewId = created.body.data.review.id;

    // Still PENDING - not counted yet.
    let vendorRow = await prisma.vendor.findUnique({ where: { id: vendor.id } });
    expect(vendorRow!.reviewCount).toBe(0);

    const adminToken = await createUserAndLogin(Role.ADMIN, "rating-agg-admin@example.test");
    const publishRes = await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PUBLISHED" });
    expect(publishRes.status).toBe(200);

    vendorRow = await prisma.vendor.findUnique({ where: { id: vendor.id } });
    expect(vendorRow!.reviewCount).toBe(1);
    expect(vendorRow!.averageRating).toBe(4);

    // Hiding it again removes it from the aggregate.
    await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "HIDDEN" });

    vendorRow = await prisma.vendor.findUnique({ where: { id: vendor.id } });
    expect(vendorRow!.reviewCount).toBe(0);
    expect(vendorRow!.averageRating).toBe(0);
  });

  it("does not affect the vendor's rating when a review is rejected", async () => {
    const { customerToken, bookingId, vendor } = await setupCompletedBooking("rating-agg-rejected");
    const created = await createReview(customerToken, bookingId, { rating: 1 });

    const adminToken = await createUserAndLogin(Role.ADMIN, "rating-agg-rejected-admin@example.test");
    await request(app)
      .patch(`/api/v1/admin/reviews/${created.body.data.review.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "REJECTED" });

    const vendorRow = await prisma.vendor.findUnique({ where: { id: vendor.id } });
    expect(vendorRow!.reviewCount).toBe(0);
    expect(vendorRow!.averageRating).toBe(0);
  });

  it("computes a correct average across multiple published reviews", async () => {
    const first = await setupCompletedBooking("rating-multi-1", { price: 50000 });
    const secondVendorToken = first.vendorToken;
    // Reuse the same vendor for a second completed booking from a
    // different customer, so both reviews land on the same vendor.
    const secondCustomerToken = await createUserAndLogin(Role.CUSTOMER, "rating-multi-customer-2@example.test");
    const date2 = futureDateString(45);
    await setVendorAvailability(secondVendorToken, date2, "AVAILABLE");
    const event2 = await createEvent(secondCustomerToken);
    const bookingRes2 = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${secondCustomerToken}`)
      .send({ vendorId: first.vendor.id, eventId: event2.id, packageId: first.pkg.id, weddingDate: date2 });
    const bookingId2 = bookingRes2.body.data.booking.id;
    await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId2}/accept`)
      .set("Authorization", `Bearer ${secondVendorToken}`)
      .send({});
    await prisma.booking.update({ where: { id: bookingId2 }, data: { status: "COMPLETED", completedAt: new Date() } });

    const review1 = await createReview(first.customerToken, first.bookingId, { rating: 5 });
    const review2 = await createReview(secondCustomerToken, bookingId2, { rating: 3 });

    const adminToken = await createUserAndLogin(Role.ADMIN, "rating-multi-admin@example.test");
    await request(app).patch(`/api/v1/admin/reviews/${review1.body.data.review.id}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "PUBLISHED" });
    await request(app).patch(`/api/v1/admin/reviews/${review2.body.data.review.id}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "PUBLISHED" });

    const vendorRow = await prisma.vendor.findUnique({ where: { id: first.vendor.id } });
    expect(vendorRow!.reviewCount).toBe(2);
    expect(vendorRow!.averageRating).toBe(4);
  });
});

describe("Public vendor reviews endpoint", () => {
  it("only returns PUBLISHED reviews, with a rating summary and distribution", async () => {
    const { customerToken, bookingId, vendor } = await setupCompletedBooking("public-reviews-1");
    const created = await createReview(customerToken, bookingId, { rating: 5, comment: "Excellent all around, could not be happier." });
    const adminToken = await createUserAndLogin(Role.ADMIN, "public-reviews-admin@example.test");
    await request(app).patch(`/api/v1/admin/reviews/${created.body.data.review.id}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status: "PUBLISHED" });

    const res = await request(app).get(`/api/v1/vendors/${vendor.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.summary.averageRating).toBe(5);
    expect(res.body.data.summary.reviewCount).toBe(1);
    expect(res.body.data.summary.distribution["5"]).toBe(1);
    // Never expose the reviewing customer's private contact info.
    expect(res.body.data.items[0].customer).not.toHaveProperty("email");
    expect(res.body.data.items[0].customer).not.toHaveProperty("phone");
  });

  it("excludes PENDING/HIDDEN/REJECTED reviews from the public list", async () => {
    const { customerToken, bookingId, vendor } = await setupCompletedBooking("public-reviews-hidden");
    await createReview(customerToken, bookingId);

    const res = await request(app).get(`/api/v1/vendors/${vendor.id}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.summary.reviewCount).toBe(0);
  });
});

describe("Customer's own reviews endpoint", () => {
  it("lists every status of the customer's own reviews", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("customer-own-reviews");
    await createReview(customerToken, bookingId);

    const res = await request(app).get("/api/v1/reviews").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe("PENDING");
  });

  it("never returns another customer's reviews", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("customer-own-reviews-other");
    await createReview(customerToken, bookingId);

    const otherCustomerToken = await createUserAndLogin(Role.CUSTOMER, "customer-own-reviews-attacker@example.test");
    const res = await request(app).get("/api/v1/reviews").set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it("rejects a vendor from using the customer's own-reviews endpoint", async () => {
    const { vendorToken } = await setupCompletedBooking("customer-own-reviews-vendor");
    const res = await request(app).get("/api/v1/reviews").set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Vendor's own reviews endpoint", () => {
  it("shows the vendor every status of their own reviews, not just PUBLISHED", async () => {
    const { customerToken, bookingId, vendorToken } = await setupCompletedBooking("vendor-own-reviews");
    await createReview(customerToken, bookingId);

    const res = await request(app).get("/api/v1/vendors/me/reviews").set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe("PENDING");
  });

  it("never returns another vendor's reviews through the vendor-scoped route", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("vendor-own-reviews-other");
    await createReview(customerToken, bookingId);

    const otherVendorToken = await createUserAndLogin(Role.VENDOR, "vendor-own-reviews-other-vendor@example.test");
    await createVendorProfile(otherVendorToken, { businessName: "Unrelated Vendor" });
    const res = await request(app).get("/api/v1/vendors/me/reviews").set("Authorization", `Bearer ${otherVendorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe("Admin review moderation", () => {
  it("lets an admin list and filter reviews by status", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("admin-review-list");
    await createReview(customerToken, bookingId);

    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-review-list-admin@example.test");
    const res = await request(app).get("/api/v1/admin/reviews?status=PENDING").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items.every((r: { status: string }) => r.status === "PENDING")).toBe(true);
  });

  it("rejects a non-admin trying to moderate a review", async () => {
    const { customerToken, bookingId } = await setupCompletedBooking("admin-review-nonadmin");
    const created = await createReview(customerToken, bookingId);

    const res = await request(app)
      .patch(`/api/v1/admin/reviews/${created.body.data.review.id}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "PUBLISHED" });
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated admin review list request", async () => {
    const res = await request(app).get("/api/v1/admin/reviews");
    expect(res.status).toBe(401);
  });
});

describe("Booking completion (vendor-triggered)", () => {
  it("rejects marking a booking complete before its event date has passed", async () => {
    const { vendorToken, bookingId } = await setupConfirmedBooking("complete-too-early");
    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/complete`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EVENT_NOT_YET_OCCURRED");
  });

  it("rejects a booking that was never accepted/confirmed", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "complete-pending-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Complete Pending Vendor" });
    const pkg = await createVendorPackage(vendorToken, { price: 40000 });
    const date = futureDateString(20);
    await setVendorAvailability(vendorToken, date, "AVAILABLE");
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "complete-pending-customer@example.test");
    const event = await createEvent(customerToken);
    const bookingRes = await request(app)
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id, eventId: event.id, packageId: pkg.id, weddingDate: date });

    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingRes.body.data.booking.id}/complete`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("rejects a different vendor completing someone else's booking (IDOR)", async () => {
    const { bookingId } = await setupAcceptedBooking("complete-idor");
    const otherVendorToken = await createUserAndLogin(Role.VENDOR, "complete-idor-other@example.test");
    const res = await request(app)
      .patch(`/api/v1/vendors/me/bookings/${bookingId}/complete`)
      .set("Authorization", `Bearer ${otherVendorToken}`)
      .send({});
    expect(res.status).toBe(404);
  });
});

describe("Vendor search by rating", () => {
  async function publishReview(rating: number, suffix: string) {
    const { customerToken, bookingId, vendor } = await setupCompletedBooking(suffix);
    const created = await createReview(customerToken, bookingId, { rating, comment: "A perfectly serviceable review comment." });
    const adminToken = await createUserAndLogin(Role.ADMIN, `${suffix}-admin@example.test`);
    await request(app)
      .patch(`/api/v1/admin/reviews/${created.body.data.review.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PUBLISHED" });
    return vendor;
  }

  it("filters search results by minRating", async () => {
    const highRated = await publishReview(5, "search-rating-high");
    const lowRated = await publishReview(2, "search-rating-low");

    const res = await request(app).get("/api/v1/vendors?minRating=4");
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((v: { id: string }) => v.id);
    expect(ids).toContain(highRated.id);
    expect(ids).not.toContain(lowRated.id);
  });

  it("sorts by rating descending when sort=rating", async () => {
    const highRated = await publishReview(5, "search-sort-high");
    const lowRated = await publishReview(1, "search-sort-low");

    const res = await request(app).get("/api/v1/vendors?sort=rating&limit=100");
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((v: { id: string }) => v.id);
    expect(ids.indexOf(highRated.id)).toBeLessThan(ids.indexOf(lowRated.id));
  });
});
