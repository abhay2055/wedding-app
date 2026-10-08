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

describe("PATCH /api/v1/users/me", () => {
  it("allows updating name and phone", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "update-me@example.test");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name", phone: "9998887777" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe("Updated Name");
    expect(res.body.data.user.phone).toBe("9998887777");
  });

  it("does not allow changing email through this endpoint", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "no-email-change@example.test");

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "changed@example.test", name: "Still Allowed" });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("no-email-change@example.test");
  });
});
