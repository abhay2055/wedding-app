import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const PASSWORD = "ValidPass123";

async function createUserAndLogin(role: Role, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.create({
    data: { name: `Test ${role}`, email, passwordHash, role },
  });

  const res = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  return res.body.data.accessToken as string;
}

describe("Authentication and role-based authorization", () => {
  it("rejects unauthenticated access to a protected endpoint", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns the authenticated user's profile via GET /users/me", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "me@example.test");

    const res = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("me@example.test");
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a CUSTOMER accessing an ADMIN endpoint", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "customer-forbidden@example.test");

    const res = await request(app).get("/api/v1/admin/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("rejects a VENDOR accessing an ADMIN endpoint", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "vendor-forbidden@example.test");

    const res = await request(app).get("/api/v1/admin/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("allows an ADMIN to access an ADMIN endpoint", async () => {
    const token = await createUserAndLogin(Role.ADMIN, "admin-ok@example.test");

    const res = await request(app).get("/api/v1/admin/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.admin.role).toBe("ADMIN");
  });

  it("rejects a CUSTOMER accessing VENDOR-only endpoints", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "customer-no-vendor@example.test");

    const res = await request(app).get("/api/v1/vendors/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("allows a VENDOR to create and fetch its own vendor profile", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "vendor-ok@example.test");

    const createRes = await request(app)
      .post("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Test Decor", city: "Mumbai" });
    expect(createRes.status).toBe(201);

    const getRes = await request(app).get("/api/v1/vendors/me").set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.vendor.businessName).toBe("Test Decor");
  });

  it("rejects creating a vendor profile without a city (no pan-India default)", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "vendor-no-city@example.test");

    const res = await request(app)
      .post("/api/v1/vendors/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ businessName: "Test Decor" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid/garbage access token", async () => {
    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
