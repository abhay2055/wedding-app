import request from "supertest";
import { app } from "./testApp";
import { prisma } from "../src/config/prisma";
import { Role } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const VALID_PASSWORD = "ValidPass123";

describe("POST /api/v1/auth/register", () => {
  it("registers a new customer and never returns the password hash", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Test Customer",
      email: "new-customer@example.test",
      phone: "9876543210",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("CUSTOMER");
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "new-customer@example.test" } });
    expect(stored.passwordHash).not.toBe(VALID_PASSWORD);
    expect(stored.passwordHash.length).toBeGreaterThan(20);
  });

  it("cannot be used to self-register an ADMIN account", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Sneaky Admin",
        email: "sneaky@example.test",
        password: VALID_PASSWORD,
        role: "ADMIN",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("CUSTOMER");
  });

  it("rejects duplicate email registration", async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "First",
      email: "dupe@example.test",
      password: VALID_PASSWORD,
    });

    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Second",
      email: "dupe@example.test",
      password: VALID_PASSWORD,
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("rejects an invalid/weak password", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      name: "Weak Password",
      email: "weak@example.test",
      password: "short",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    const passwordHash = await hashPassword(VALID_PASSWORD);
    await prisma.user.create({
      data: {
        name: "Login User",
        email: "login@example.test",
        passwordHash,
        role: Role.CUSTOMER,
      },
    });
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.test", password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects an invalid password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "login@example.test", password: "WrongPassword123" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a non-existent email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.test", password: VALID_PASSWORD });

    expect(res.status).toBe(401);
  });
});
