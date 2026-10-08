import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role, VerificationStatus } from "@prisma/client";
import { createCategory, createUserAndLogin, createVendorProfile } from "./helpers";

describe("Vendor profile creation/update", () => {
  it("creates a vendor profile with a category and generates a unique slug", async () => {
    const category = await createCategory("Photography");
    const token = await createUserAndLogin(Role.VENDOR, "photo-vendor@example.test");

    const res = await request(app)
      .post("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Sharma Wedding Photography", city: "Jalandhar", categoryId: category.id });

    expect(res.status).toBe(201);
    expect(res.body.data.vendor.slug).toBe("sharma-wedding-photography");
    expect(res.body.data.vendor.verificationStatus).toBe("PENDING");
    expect(res.body.data.vendor.category.name).toBe("Photography");
  });

  it("requires a city (no pan-India default)", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "no-city-vendor@example.test");
    const res = await request(app)
      .post("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "No City Co" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown categoryId", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "bad-category-vendor@example.test");
    const res = await request(app)
      .post("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Bad Category Co", city: "Delhi", categoryId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(400);
  });

  it("keeps the existing slug when businessName changes", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "slug-stable-vendor@example.test");
    const created = await createVendorProfile(token, { businessName: "Original Name" });

    const res = await request(app)
      .patch("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Renamed Business" });

    expect(res.status).toBe(200);
    expect(res.body.data.vendor.businessName).toBe("Renamed Business");
    expect(res.body.data.vendor.slug).toBe(created.slug);
  });

  it("does not allow a vendor to set its own verificationStatus or eventsCompleted", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "self-verify-vendor@example.test");
    await createVendorProfile(token);

    const res = await request(app)
      .patch("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ verificationStatus: "VERIFIED", eventsCompleted: 999, businessName: "Still Pending Co" });

    expect(res.status).toBe(200);
    expect(res.body.data.vendor.verificationStatus).toBe("PENDING");
    expect(res.body.data.vendor.eventsCompleted).toBe(0);
  });
});

describe("Public vendor profile", () => {
  it("exposes public fields, portfolio and active packages, but never user/password data", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "public-profile-vendor@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Public Profile Co" });
    await prisma.vendor.update({ where: { id: vendor.id }, data: { verificationStatus: VerificationStatus.VERIFIED } });
    await prisma.vendorPortfolio.create({
      data: { vendorId: vendor.id, type: "IMAGE", url: "https://example.test/a.jpg" },
    });
    await prisma.vendorPackage.create({
      data: { vendorId: vendor.id, name: "Basic", price: 1000, items: { create: [{ name: "Item 1" }] } },
    });

    const res = await request(app).get(`/api/v1/vendors/${vendor.id}`);

    expect(res.status).toBe(200);
    const body = res.body.data.vendor;
    expect(body.businessName).toBe("Public Profile Co");
    expect(body.portfolio).toHaveLength(1);
    expect(body.packages).toHaveLength(1);
    expect(body.packages[0].items).toHaveLength(1);
    expect(body).not.toHaveProperty("user");
    expect(JSON.stringify(body)).not.toMatch(/passwordHash/i);
  });

  it("is also reachable by its SEO-friendly slug", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "slug-lookup-vendor@example.test");
    const vendor = await createVendorProfile(token, { businessName: "Slug Lookup Co" });
    await prisma.vendor.update({ where: { id: vendor.id }, data: { verificationStatus: VerificationStatus.VERIFIED } });

    const res = await request(app).get(`/api/v1/vendors/slug/${vendor.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.vendor.id).toBe(vendor.id);
  });

  it("returns 404 for a rejected vendor", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "rejected-vendor@example.test");
    const vendor = await createVendorProfile(token);
    await prisma.vendor.update({ where: { id: vendor.id }, data: { verificationStatus: VerificationStatus.REJECTED } });

    const res = await request(app).get(`/api/v1/vendors/${vendor.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a deactivated vendor", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "inactive-vendor@example.test");
    const vendor = await createVendorProfile(token);
    await prisma.vendor.update({ where: { id: vendor.id }, data: { isActive: false } });

    const res = await request(app).get(`/api/v1/vendors/${vendor.id}`);
    expect(res.status).toBe(404);
  });
});

describe("Vendor search", () => {
  async function seedSearchableVendors() {
    const photography = await createCategory("Photography");
    const catering = await createCategory("Catering");

    const v1Token = await createUserAndLogin(Role.VENDOR, "search-v1@example.test");
    const v1 = await createVendorProfile(v1Token, {
      businessName: "Cheap Photographer",
      city: "Mumbai",
      categoryId: photography.id,
    });
    await prisma.vendor.update({
      where: { id: v1.id },
      data: { startingPrice: 10000, verificationStatus: VerificationStatus.VERIFIED },
    });

    const v2Token = await createUserAndLogin(Role.VENDOR, "search-v2@example.test");
    const v2 = await createVendorProfile(v2Token, {
      businessName: "Expensive Photographer",
      city: "Mumbai",
      categoryId: photography.id,
    });
    await prisma.vendor.update({ where: { id: v2.id }, data: { startingPrice: 90000 } });

    const v3Token = await createUserAndLogin(Role.VENDOR, "search-v3@example.test");
    const v3 = await createVendorProfile(v3Token, {
      businessName: "Delhi Caterer",
      city: "Delhi",
      categoryId: catering.id,
    });
    await prisma.vendor.update({ where: { id: v3.id }, data: { startingPrice: 50000 } });

    return { photography, catering, v1, v2, v3 };
  }

  it("filters by category slug", async () => {
    const { catering } = await seedSearchableVendors();
    const res = await request(app).get(`/api/v1/vendors?category=${catering.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].businessName).toBe("Delhi Caterer");
  });

  it("filters by city", async () => {
    await seedSearchableVendors();
    const res = await request(app).get("/api/v1/vendors?city=Delhi");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].city).toBe("Delhi");
  });

  it("filters by price range", async () => {
    await seedSearchableVendors();
    const res = await request(app).get("/api/v1/vendors?minPrice=40000&maxPrice=60000");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].businessName).toBe("Delhi Caterer");
  });

  it("filters by verified=true", async () => {
    await seedSearchableVendors();
    const res = await request(app).get("/api/v1/vendors?verified=true");
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((v: { verificationStatus: string }) => v.verificationStatus === "VERIFIED")).toBe(true);
  });

  it("paginates results and respects the max limit", async () => {
    await seedSearchableVendors();
    const res = await request(app).get("/api/v1/vendors?limit=1&page=1");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 1, total: 3 });

    const tooLarge = await request(app).get("/api/v1/vendors?limit=1000");
    expect(tooLarge.status).toBe(400);
  });

  it("sorts by price ascending/descending", async () => {
    await seedSearchableVendors();
    const asc = await request(app).get("/api/v1/vendors?sort=price_asc");
    const prices = asc.body.data.items.map((v: { startingPrice: number }) => v.startingPrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("rejects an unsupported sort value instead of silently ignoring it", async () => {
    const res = await request(app).get("/api/v1/vendors?sort=rating_desc");
    expect(res.status).toBe(400);
  });

  it("never returns a rejected vendor from search", async () => {
    const { v1 } = await seedSearchableVendors();
    await prisma.vendor.update({ where: { id: v1.id }, data: { verificationStatus: VerificationStatus.REJECTED } });

    const res = await request(app).get("/api/v1/vendors?limit=50");
    const names = res.body.data.items.map((v: { businessName: string }) => v.businessName);
    expect(names).not.toContain("Cheap Photographer");
  });
});

describe("Categories API", () => {
  it("only returns active categories publicly", async () => {
    await createCategory("Active One");
    const inactive = await createCategory("Inactive One");
    await prisma.vendorCategory.update({ where: { id: inactive.id }, data: { isActive: false } });

    const res = await request(app).get("/api/v1/categories");
    expect(res.status).toBe(200);
    const names = res.body.data.categories.map((c: { name: string }) => c.name);
    expect(names).toContain("Active One");
    expect(names).not.toContain("Inactive One");
  });
});
