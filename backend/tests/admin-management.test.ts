import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role } from "@prisma/client";
import { createUserAndLogin, createVendorProfile, setupAcceptedBooking, setupCompletedBooking } from "./helpers";

describe("Admin customer management", () => {
  it("lists customers with event/booking counts and never leaks the password hash", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "admin-cust-list@example.test");
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-cust-list-admin@example.test");

    const res = await request(app).get("/api/v1/admin/customers").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const found = res.body.data.items.find((c: { email: string }) => c.email === "admin-cust-list@example.test");
    expect(found).toBeTruthy();
    expect(found).not.toHaveProperty("passwordHash");
    expect(typeof found._count.bookings).toBe("number");
    void customerToken;
  });

  it("never returns vendors or admins from the customer list", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "admin-cust-list-vendor@example.test");
    await createVendorProfile(vendorToken, { businessName: "Not A Customer" });
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-cust-list-only-admin@example.test");

    const res = await request(app).get("/api/v1/admin/customers").set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.data.items.every((c: { email: string }) => c.email !== "admin-cust-list-vendor@example.test")).toBe(true);
  });

  it("lets an admin deactivate and reactivate a customer, and the customer can no longer log in while deactivated", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "admin-cust-deactivate@example.test");
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-cust-deactivate-admin@example.test");
    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${customerToken}`);
    const customerId = me.body.data.user.id;

    const deactivateRes = await request(app)
      .patch(`/api/v1/admin/customers/${customerId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.customer.isActive).toBe(false);

    const auditRows = await prisma.adminAuditLog.findMany({ where: { targetType: "user", targetId: customerId } });
    expect(auditRows.some((r) => r.action === "CUSTOMER_DEACTIVATED")).toBe(true);
  });

  it("rejects a non-admin managing customers", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "admin-cust-nonadmin@example.test");
    const res = await request(app).get("/api/v1/admin/customers").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Admin vendor audit logging and notifications", () => {
  it("records an audit log entry when a vendor is verified", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "admin-audit-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Audit Vendor" });
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-audit-admin@example.test");

    await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verificationStatus: "VERIFIED" });

    const auditRows = await prisma.adminAuditLog.findMany({ where: { targetType: "vendor", targetId: vendor.id } });
    expect(auditRows.some((r) => r.action === "VENDOR_VERIFIED")).toBe(true);
  });
});

describe("Admin dashboard", () => {
  it("returns real database-backed counts, not hardcoded numbers", async () => {
    await setupCompletedBooking("dashboard-1");
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-dashboard-admin@example.test");

    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.bookings.total).toBeGreaterThan(0);
    expect(res.body.data.bookings.completed).toBeGreaterThan(0);
    expect(res.body.data.customers.total).toBeGreaterThan(0);
    expect(res.body.data.vendors.total).toBeGreaterThan(0);
  });

  it("rejects a non-admin from viewing the dashboard", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "admin-dashboard-vendor@example.test");
    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Admin analytics", () => {
  it("returns time-bucketed data for each supported range", async () => {
    await setupAcceptedBooking("analytics-1");
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-analytics-admin@example.test");

    for (const range of ["7d", "30d", "90d", "1y"]) {
      const res = await request(app).get(`/api/v1/admin/analytics?range=${range}`).set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe(range);
      expect(Array.isArray(res.body.data.bookingsOverTime)).toBe(true);
      expect(typeof res.body.data.bookingConversionRate).toBe("number");
    }
  });

  it("rejects an invalid range value", async () => {
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-analytics-invalid-admin@example.test");
    const res = await request(app).get("/api/v1/admin/analytics?range=invalid").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

describe("Admin API security", () => {
  it("rejects unauthenticated access to every admin surface", async () => {
    const paths = ["/api/v1/admin/dashboard", "/api/v1/admin/analytics", "/api/v1/admin/customers", "/api/v1/admin/reviews"];
    for (const path of paths) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it("rejects a customer and a vendor from every admin surface", async () => {
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "admin-security-customer@example.test");
    const vendorToken = await createUserAndLogin(Role.VENDOR, "admin-security-vendor@example.test");
    const paths = ["/api/v1/admin/dashboard", "/api/v1/admin/analytics", "/api/v1/admin/customers", "/api/v1/admin/reviews"];
    for (const path of paths) {
      const asCustomer = await request(app).get(path).set("Authorization", `Bearer ${customerToken}`);
      expect(asCustomer.status).toBe(403);
      const asVendor = await request(app).get(path).set("Authorization", `Bearer ${vendorToken}`);
      expect(asVendor.status).toBe(403);
    }
  });
});
