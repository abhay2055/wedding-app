import request from "supertest";
import { app } from "./testApp";
import { Role } from "@prisma/client";
import { createCategory, createUserAndLogin, createVendorProfile } from "./helpers";

describe("Admin category management", () => {
  it("allows an admin to create, update and deactivate a category", async () => {
    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-cat@example.test");

    const createRes = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Pet Care for Weddings" });
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.data.category.id;
    expect(createRes.body.data.category.slug).toBe("pet-care-for-weddings");

    const updateRes = await request(app)
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ description: "Updated description" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.category.description).toBe("Updated description");

    const deactivateRes = await request(app)
      .delete(`/api/v1/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.category.isActive).toBe(false);

    // Soft-deactivated, not destroyed.
    const stillListed = await request(app)
      .get("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(stillListed.body.data.categories.some((c: { id: string }) => c.id === categoryId)).toBe(true);
  });

  it("rejects a CUSTOMER from managing categories", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "customer-cat@example.test");
    const res = await request(app)
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Fail" });
    expect(res.status).toBe(403);
  });
});

describe("Admin vendor management", () => {
  it("lists vendors and allows verification and activation changes", async () => {
    const category = await createCategory("Catering");
    const vendorToken = await createUserAndLogin(Role.VENDOR, "admin-target-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, {
      businessName: "Admin Target Vendor",
      categoryId: category.id,
    });

    const adminToken = await createUserAndLogin(Role.ADMIN, "admin-vendor-mgmt@example.test");

    const listRes = await request(app).get("/api/v1/admin/vendors").set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.some((v: { id: string }) => v.id === vendor.id)).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/admin/vendors/${vendor.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.vendor.verificationStatus).toBe("PENDING");

    const verifyRes = await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ verificationStatus: "VERIFIED" });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.vendor.verificationStatus).toBe("VERIFIED");

    const deactivateRes = await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.vendor.isActive).toBe(false);
  });

  it("rejects a VENDOR from verifying itself", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "self-verify-attempt@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Self Verify Attempt Co" });

    const res = await request(app)
      .patch(`/api/v1/admin/vendors/${vendor.id}/verify`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ verificationStatus: "VERIFIED" });
    expect(res.status).toBe(403);
  });

  it("rejects a CUSTOMER from accessing any admin API", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "customer-admin-attempt@example.test");
    const res = await request(app).get("/api/v1/admin/vendors").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request to admin APIs", async () => {
    const res = await request(app).get("/api/v1/admin/vendors");
    expect(res.status).toBe(401);
  });
});
