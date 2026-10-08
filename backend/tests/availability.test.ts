import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role } from "@prisma/client";
import { createCategory, createUserAndLogin, createVendorProfile, futureDateString } from "./helpers";

const DAY_15 = futureDateString(30);
const DAY_16 = futureDateString(31);
const DAY_17 = futureDateString(32);

describe("Vendor availability - create/update/delete", () => {
  it("creates a new availability record", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-create@example.test");
    await createVendorProfile(token);

    const res = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "AVAILABLE" });

    expect(res.status).toBe(201);
    expect(res.body.data.availability.status).toBe("AVAILABLE");
  });

  it("updates (upserts) an existing date instead of creating a duplicate", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-upsert@example.test");
    await createVendorProfile(token);

    const first = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "AVAILABLE" });
    const second = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "UNAVAILABLE", note: "changed my mind" });

    expect(second.status).toBe(201);
    expect(second.body.data.availability.id).toBe(first.body.data.availability.id);
    expect(second.body.data.availability.status).toBe("UNAVAILABLE");

    const list = await request(app)
      .get("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data.availability).toHaveLength(1);
  });

  it("updates a record via PATCH by id", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-patch@example.test");
    await createVendorProfile(token);
    const created = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "AVAILABLE" });

    const res = await request(app)
      .patch(`/api/v1/vendors/me/availability/${created.body.data.availability.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "BLOCKED", note: "personal event" });

    expect(res.status).toBe(200);
    expect(res.body.data.availability.status).toBe("BLOCKED");
  });

  it("deletes a record", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-delete@example.test");
    await createVendorProfile(token);
    const created = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "AVAILABLE" });

    const del = await request(app)
      .delete(`/api/v1/vendors/me/availability/${created.body.data.availability.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app)
      .get("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.data.availability).toHaveLength(0);
  });

  it("prevents a vendor from modifying or deleting another vendor's availability", async () => {
    const tokenA = await createUserAndLogin(Role.VENDOR, "avail-vendor-a@example.test");
    await createVendorProfile(tokenA, { businessName: "Availability Vendor A" });
    const created = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ date: DAY_15, status: "AVAILABLE" });
    const availabilityId = created.body.data.availability.id;

    const tokenB = await createUserAndLogin(Role.VENDOR, "avail-vendor-b@example.test");
    await createVendorProfile(tokenB, { businessName: "Availability Vendor B" });

    const patchRes = await request(app)
      .patch(`/api/v1/vendors/me/availability/${availabilityId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ status: "BLOCKED" });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/vendors/me/availability/${availabilityId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);
  });

  it("rejects an invalid date", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-bad-date@example.test");
    await createVendorProfile(token);
    const res = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2027-99-99", status: "AVAILABLE" });
    expect(res.status).toBe(400);
  });

  it("rejects a past date", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-past-date@example.test");
    await createVendorProfile(token);
    const res = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2020-01-01", status: "AVAILABLE" });
    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/api/v1/vendors/me/availability").send({ date: DAY_15, status: "AVAILABLE" });
    expect(res.status).toBe(401);
  });

  it("rejects a CUSTOMER from using vendor availability endpoints", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "avail-customer@example.test");
    const res = await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "AVAILABLE" });
    expect(res.status).toBe(403);
  });
});

describe("Vendor availability - bulk range", () => {
  it("sets a range of dates in one request", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-bulk@example.test");
    await createVendorProfile(token);

    const res = await request(app)
      .post("/api/v1/vendors/me/availability/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: DAY_15, endDate: DAY_17, status: "UNAVAILABLE" });

    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(3);
  });

  it("rejects startDate after endDate", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-bulk-bad-order@example.test");
    await createVendorProfile(token);
    const res = await request(app)
      .post("/api/v1/vendors/me/availability/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: DAY_17, endDate: DAY_15, status: "AVAILABLE" });
    expect(res.status).toBe(400);
  });

  it("rejects an unreasonably large range", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-bulk-too-big@example.test");
    await createVendorProfile(token);
    const res = await request(app)
      .post("/api/v1/vendors/me/availability/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: "2027-01-01", endDate: "2030-01-01", status: "AVAILABLE" });
    expect(res.status).toBe(400);
  });
});

describe("Public vendor availability", () => {
  it("returns availability without exposing private notes", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-public@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Public Availability Co" });
    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "BLOCKED", note: "top secret reason" });

    const res = await request(app).get(`/api/v1/vendors/${vendor.id}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.data.availability).toEqual([{ date: DAY_15, status: "BLOCKED" }]);
    expect(JSON.stringify(res.body)).not.toMatch(/top secret reason/);
  });

  it("rejects an unreasonably large date range on the public endpoint", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "avail-public-range@example.test");
    const vendor = await createVendorProfile(token);
    const res = await request(app).get(`/api/v1/vendors/${vendor.id}/availability?from=2027-01-01&to=2027-12-31`);
    expect(res.status).toBe(400);
  });
});

describe("Vendor search - availability filtering", () => {
  async function seedVendorsWithAvailability() {
    const category = await createCategory("Photography");

    const availableToken = await createUserAndLogin(Role.VENDOR, "search-avail-yes@example.test");
    const availableVendor = await createVendorProfile(availableToken, {
      businessName: "Available Vendor",
      city: "Mumbai",
      categoryId: category.id,
    });
    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${availableToken}`)
      .send({ date: DAY_15, status: "AVAILABLE" });

    const unavailableToken = await createUserAndLogin(Role.VENDOR, "search-avail-no@example.test");
    await createVendorProfile(unavailableToken, { businessName: "Unavailable Vendor", city: "Mumbai", categoryId: category.id });
    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${unavailableToken}`)
      .send({ date: DAY_15, status: "UNAVAILABLE" });

    const blockedToken = await createUserAndLogin(Role.VENDOR, "search-avail-blocked@example.test");
    await createVendorProfile(blockedToken, { businessName: "Blocked Vendor", city: "Mumbai", categoryId: category.id });
    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${blockedToken}`)
      .send({ date: DAY_15, status: "BLOCKED" });

    const unknownToken = await createUserAndLogin(Role.VENDOR, "search-avail-unknown@example.test");
    await createVendorProfile(unknownToken, { businessName: "Unknown Vendor", city: "Mumbai", categoryId: category.id });
    // No availability record at all for DAY_15.

    return { category, availableVendor };
  }

  it("only returns vendors explicitly AVAILABLE on the given date", async () => {
    await seedVendorsWithAvailability();
    const res = await request(app).get(`/api/v1/vendors?availableOn=${DAY_15}`);
    expect(res.status).toBe(200);
    const names = res.body.data.items.map((v: { businessName: string }) => v.businessName);
    expect(names).toEqual(["Available Vendor"]);
  });

  it("excludes UNAVAILABLE vendors", async () => {
    await seedVendorsWithAvailability();
    const res = await request(app).get(`/api/v1/vendors?availableOn=${DAY_15}`);
    const names = res.body.data.items.map((v: { businessName: string }) => v.businessName);
    expect(names).not.toContain("Unavailable Vendor");
  });

  it("excludes BLOCKED vendors", async () => {
    await seedVendorsWithAvailability();
    const res = await request(app).get(`/api/v1/vendors?availableOn=${DAY_15}`);
    const names = res.body.data.items.map((v: { businessName: string }) => v.businessName);
    expect(names).not.toContain("Blocked Vendor");
  });

  it("excludes vendors with no availability record at all (unknown != available)", async () => {
    await seedVendorsWithAvailability();
    const res = await request(app).get(`/api/v1/vendors?availableOn=${DAY_15}`);
    const names = res.body.data.items.map((v: { businessName: string }) => v.businessName);
    expect(names).not.toContain("Unknown Vendor");
  });

  it("combines city + category + availableOn filters", async () => {
    const { category } = await seedVendorsWithAvailability();
    const res = await request(app).get(`/api/v1/vendors?city=Mumbai&category=${category.slug}&availableOn=${DAY_15}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].businessName).toBe("Available Vendor");
  });

  it("rejects combining availableOn with availableFrom/availableTo", async () => {
    const res = await request(app).get(`/api/v1/vendors?availableOn=${DAY_15}&availableFrom=${DAY_15}&availableTo=${DAY_16}`);
    expect(res.status).toBe(400);
  });
});

describe("Vendor search - multi-day availability", () => {
  it("only includes a vendor available on every day of the range", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "multiday-vendor@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Multiday Vendor" });

    await request(app)
      .post("/api/v1/vendors/me/availability/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: DAY_15, endDate: DAY_16, status: "AVAILABLE" });

    // Only 2 of the 3 required days are AVAILABLE so far - should not qualify.
    const partial = await request(app).get(`/api/v1/vendors?availableFrom=${DAY_15}&availableTo=${DAY_17}`);
    expect(partial.body.data.items.map((v: { id: string }) => v.id)).not.toContain(vendor.id);

    // Mark the 3rd day AVAILABLE too - should now qualify for the full range.
    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_17, status: "AVAILABLE" });

    const full = await request(app).get(`/api/v1/vendors?availableFrom=${DAY_15}&availableTo=${DAY_17}`);
    expect(full.body.data.items.map((v: { id: string }) => v.id)).toContain(vendor.id);
  });

  it("stops qualifying once a day in the range is changed to BLOCKED", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "multiday-vendor-2@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Multiday Vendor 2" });

    await request(app)
      .post("/api/v1/vendors/me/availability/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ startDate: DAY_15, endDate: DAY_17, status: "AVAILABLE" });

    const beforeBlock = await request(app).get(`/api/v1/vendors?availableFrom=${DAY_15}&availableTo=${DAY_17}`);
    expect(beforeBlock.body.data.items.map((v: { id: string }) => v.id)).toContain(vendor.id);

    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_16, status: "BLOCKED" });

    const afterBlock = await request(app).get(`/api/v1/vendors?availableFrom=${DAY_15}&availableTo=${DAY_17}`);
    expect(afterBlock.body.data.items.map((v: { id: string }) => v.id)).not.toContain(vendor.id);
  });
});

describe("Admin availability access", () => {
  it("lets an admin view a vendor's full availability including notes", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "admin-avail-view@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Admin Avail View Co" });
    await request(app)
      .post("/api/v1/vendors/me/availability")
      .set("Authorization", `Bearer ${token}`)
      .send({ date: DAY_15, status: "BLOCKED", note: "internal reason" });

    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-avail-viewer@example.test");
    const res = await request(app)
      .get(`/api/v1/admin/vendors/${vendor.id}/availability`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.availability[0].note).toBe("internal reason");
  });

  it("lets an admin correct a vendor's availability for a specific date, recording an audit entry", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "admin-avail-correct@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Admin Avail Correct Co" });
    const adminUser = await createUserAndLogin(Role.ADMIN, "admin-avail-corrector@example.test");

    const res = await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/availability/${DAY_15}`)
      .set("Authorization", `Bearer ${adminUser}`)
      .send({ status: "AVAILABLE" });

    expect(res.status).toBe(200);
    expect(res.body.data.availability.status).toBe("AVAILABLE");

    const auditRows = await prisma.adminAuditLog.findMany({ where: { targetType: "VendorAvailability", targetId: vendor.id } });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe("AVAILABILITY_UPDATE");
  });

  it("rejects a non-admin from accessing admin availability endpoints", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "admin-avail-non-admin@example.test");
    const vendor = await createVendorProfile(token);
    const res = await request(app).get(`/api/v1/admin/vendors/${vendor.id}/availability`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
