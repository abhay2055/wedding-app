import request from "supertest";
import { app } from "./testApp";
import { Role } from "@prisma/client";
import { createUserAndLogin, createVendorProfile } from "./helpers";

describe("Vendor packages", () => {
  it("creates a package with items belonging to the authenticated vendor", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "pkg-vendor-a@example.test");
    await createVendorProfile(token, { businessName: "Package Vendor A" });

    const res = await request(app)
      .post("/api/v1/vendors/me/packages")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Premium Wedding Photography",
        price: 100000,
        items: [{ name: "2 photographers" }, { name: "Drone coverage" }, { name: "700 edited photos" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.package.items).toHaveLength(3);
  });

  it("rejects a negative price", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "pkg-vendor-neg@example.test");
    await createVendorProfile(token);
    const res = await request(app)
      .post("/api/v1/vendors/me/packages")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Package", price: -100 });
    expect(res.status).toBe(400);
  });

  it("prevents a vendor from reading, editing or deleting another vendor's package", async () => {
    const tokenA = await createUserAndLogin(Role.VENDOR, "pkg-vendor-b1@example.test");
    await createVendorProfile(tokenA, { businessName: "Package Vendor B1" });
    const createRes = await request(app)
      .post("/api/v1/vendors/me/packages")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Vendor A Package", price: 5000 });
    const packageId = createRes.body.data.package.id;

    const tokenB = await createUserAndLogin(Role.VENDOR, "pkg-vendor-b2@example.test");
    await createVendorProfile(tokenB, { businessName: "Package Vendor B2" });

    const getRes = await request(app)
      .get(`/api/v1/vendors/me/packages/${packageId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(getRes.status).toBe(404);

    const editRes = await request(app)
      .patch(`/api/v1/vendors/me/packages/${packageId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hacked" });
    expect(editRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/vendors/me/packages/${packageId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);

    // Confirm it's untouched.
    const stillThere = await request(app)
      .get(`/api/v1/vendors/me/packages/${packageId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.package.name).toBe("Vendor A Package");
  });

  it("rejects a CUSTOMER from creating a package", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "pkg-customer@example.test");
    const res = await request(app)
      .post("/api/v1/vendors/me/packages")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Fail", price: 1000 });
    expect(res.status).toBe(403);
  });
});

describe("Vendor portfolio", () => {
  it("adds a VIDEO portfolio item by URL (no file upload needed)", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "portfolio-video-vendor@example.test");
    await createVendorProfile(token);

    const res = await request(app)
      .post("/api/v1/vendors/me/portfolio")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "VIDEO", url: "https://example.test/showreel.mp4", title: "Showreel" });

    expect(res.status).toBe(201);
    expect(res.body.data.item.type).toBe("VIDEO");
  });

  it("rejects an IMAGE portfolio item with no file", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "portfolio-no-file-vendor@example.test");
    await createVendorProfile(token);

    const res = await request(app)
      .post("/api/v1/vendors/me/portfolio")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "IMAGE" });

    expect(res.status).toBe(400);
  });

  it("rejects a VIDEO portfolio item with no url", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "portfolio-no-url-vendor@example.test");
    await createVendorProfile(token);

    const res = await request(app)
      .post("/api/v1/vendors/me/portfolio")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "VIDEO" });

    expect(res.status).toBe(400);
  });

  it("prevents a vendor from deleting another vendor's portfolio item", async () => {
    const tokenA = await createUserAndLogin(Role.VENDOR, "portfolio-vendor-c1@example.test");
    await createVendorProfile(tokenA, { businessName: "Portfolio Vendor C1" });
    const createRes = await request(app)
      .post("/api/v1/vendors/me/portfolio")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ type: "VIDEO", url: "https://example.test/a.mp4" });
    const itemId = createRes.body.data.item.id;

    const tokenB = await createUserAndLogin(Role.VENDOR, "portfolio-vendor-c2@example.test");
    await createVendorProfile(tokenB, { businessName: "Portfolio Vendor C2" });

    const deleteRes = await request(app)
      .delete(`/api/v1/vendors/me/portfolio/${itemId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);

    const listRes = await request(app)
      .get("/api/v1/vendors/me/portfolio")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(listRes.body.data.portfolio).toHaveLength(1);
  });
});
