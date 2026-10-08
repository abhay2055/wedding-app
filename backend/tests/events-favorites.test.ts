import request from "supertest";
import { app } from "./testApp";
import { Role } from "@prisma/client";
import { createCategory, createUserAndLogin, createVendorProfile } from "./helpers";

describe("Wedding events", () => {
  it("creates an event owned by the authenticated customer", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "event-owner@example.test");
    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Abhay Wedding", city: "Jalandhar", weddingDate: "2027-02-15", guestCount: 300, budgetMin: 1000000, budgetMax: 1500000 });

    expect(res.status).toBe(201);
    expect(res.body.data.event.name).toBe("Abhay Wedding");
  });

  it("stores interested categories via the join table, not a string", async () => {
    const category = await createCategory("Photography");
    const token = await createUserAndLogin(Role.CUSTOMER, "event-categories@example.test");

    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cat Event", city: "Delhi", weddingDate: "2027-06-01", categoryIds: [category.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.event.interestedCategories).toHaveLength(1);
    expect(res.body.data.event.interestedCategories[0].category.name).toBe("Photography");
  });

  it("rejects guestCount < 1", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "event-bad-guests@example.test");
    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Event", city: "Delhi", weddingDate: "2027-06-01", guestCount: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects budgetMax < budgetMin", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "event-bad-budget@example.test");
    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Budget Event", city: "Delhi", weddingDate: "2027-06-01", budgetMin: 500000, budgetMax: 100000 });
    expect(res.status).toBe(400);
  });

  it("rejects endDate before weddingDate", async () => {
    const token = await createUserAndLogin(Role.CUSTOMER, "event-bad-dates@example.test");
    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Dates Event", city: "Delhi", weddingDate: "2027-06-10", endDate: "2027-06-01" });
    expect(res.status).toBe(400);
  });

  it("prevents Customer A from reading, editing or deleting Customer B's event", async () => {
    const tokenA = await createUserAndLogin(Role.CUSTOMER, "event-customer-a@example.test");
    const createRes = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Customer A Wedding", city: "Delhi", weddingDate: "2027-06-01" });
    const eventId = createRes.body.data.event.id;

    const tokenB = await createUserAndLogin(Role.CUSTOMER, "event-customer-b@example.test");

    const getRes = await request(app).get(`/api/v1/events/${eventId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hacked" });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app).delete(`/api/v1/events/${eventId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);

    const stillThere = await request(app).get(`/api/v1/events/${eventId}`).set("Authorization", `Bearer ${tokenA}`);
    expect(stillThere.status).toBe(200);
  });

  it("rejects a VENDOR from creating a wedding event", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "event-vendor@example.test");
    const res = await request(app)
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Vendor Event", city: "Delhi", weddingDate: "2027-06-01" });
    expect(res.status).toBe(403);
  });
});

describe("Favorites", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/favorites");
    expect(res.status).toBe(401);
  });

  it("lets a customer favorite and unfavorite a vendor", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "fav-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Fav Vendor Co" });
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "fav-customer@example.test");

    const addRes = await request(app)
      .post(`/api/v1/favorites/${vendor.id}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(addRes.status).toBe(201);

    const listRes = await request(app).get("/api/v1/favorites").set("Authorization", `Bearer ${customerToken}`);
    expect(listRes.body.data.favorites).toHaveLength(1);

    const removeRes = await request(app)
      .delete(`/api/v1/favorites/${vendor.id}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(removeRes.status).toBe(200);

    const listAfter = await request(app).get("/api/v1/favorites").set("Authorization", `Bearer ${customerToken}`);
    expect(listAfter.body.data.favorites).toHaveLength(0);
  });

  it("does not create a duplicate favorite when the same vendor is favorited twice", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "fav-vendor-2@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Fav Vendor Co 2" });
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "fav-customer-2@example.test");

    await request(app).post(`/api/v1/favorites/${vendor.id}`).set("Authorization", `Bearer ${customerToken}`);
    const secondAdd = await request(app)
      .post(`/api/v1/favorites/${vendor.id}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(secondAdd.status).toBe(201);

    const listRes = await request(app).get("/api/v1/favorites").set("Authorization", `Bearer ${customerToken}`);
    expect(listRes.body.data.favorites).toHaveLength(1);
  });

  it("rejects a VENDOR from using the favorites endpoints", async () => {
    const token = await createUserAndLogin(Role.VENDOR, "fav-vendor-role@example.test");
    const res = await request(app).get("/api/v1/favorites").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
