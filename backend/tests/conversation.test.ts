import request from "supertest";
import { app } from "./testApp";
import { Role } from "@prisma/client";
import { createUserAndLogin, createVendorProfile } from "./helpers";

async function setupConversation() {
  const vendorToken = await createUserAndLogin(Role.VENDOR, "conv-vendor@example.test");
  const vendor = await createVendorProfile(vendorToken, { businessName: "Conversation Vendor Co" });
  const customerToken = await createUserAndLogin(Role.CUSTOMER, "conv-customer@example.test");

  const res = await request(app)
    .post("/api/v1/conversations")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ vendorId: vendor.id });

  return { vendorToken, vendor, customerToken, conversationId: res.body.data.conversation.id };
}

describe("Conversations", () => {
  it("lets a customer create a conversation with a vendor", async () => {
    const vendorToken = await createUserAndLogin(Role.VENDOR, "conv-create-vendor@example.test");
    const vendor = await createVendorProfile(vendorToken, { businessName: "Create Conv Vendor" });
    const customerToken = await createUserAndLogin(Role.CUSTOMER, "conv-create-customer@example.test");

    const res = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id });

    expect(res.status).toBe(201);
    expect(res.body.data.conversation.vendorId).toBe(vendor.id);
  });

  it("reuses the existing conversation instead of creating a duplicate", async () => {
    const { vendor, customerToken, conversationId } = await setupConversation();

    const res = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ vendorId: vendor.id });

    expect(res.body.data.conversation.id).toBe(conversationId);
  });

  it("lets the vendor access their own conversation", async () => {
    const { vendorToken, conversationId } = await setupConversation();
    const res = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(res.status).toBe(200);
  });

  it("rejects an unrelated customer from accessing the conversation (IDOR)", async () => {
    const { conversationId } = await setupConversation();
    const otherCustomerToken = await createUserAndLogin(Role.CUSTOMER, "conv-unrelated-customer@example.test");

    const res = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(res.status).toBe(404);
  });

  it("rejects an unrelated vendor from accessing the conversation (IDOR)", async () => {
    const { conversationId } = await setupConversation();
    const otherVendorToken = await createUserAndLogin(Role.VENDOR, "conv-unrelated-vendor@example.test");
    await createVendorProfile(otherVendorToken, { businessName: "Unrelated Vendor Co" });

    const res = await request(app)
      .get(`/api/v1/conversations/${conversationId}`)
      .set("Authorization", `Bearer ${otherVendorToken}`);
    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/conversations");
    expect(res.status).toBe(401);
  });
});

describe("Messages", () => {
  it("lets the customer send and the vendor reply", async () => {
    const { customerToken, vendorToken, conversationId } = await setupConversation();

    const sent = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Are you available in March?" });
    expect(sent.status).toBe(201);

    const reply = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ body: "Yes, let's talk!" });
    expect(reply.status).toBe(201);
    expect(reply.body.data.message.senderId).toBeDefined();
  });

  it("rejects an empty message body", async () => {
    const { customerToken, conversationId } = await setupConversation();
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a message to a conversation the sender isn't part of (IDOR)", async () => {
    const { conversationId } = await setupConversation();
    const outsiderToken = await createUserAndLogin(Role.CUSTOMER, "conv-msg-outsider@example.test");
    const res = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ body: "I shouldn't be able to send this" });
    expect(res.status).toBe(404);
  });

  it("paginates messages", async () => {
    const { customerToken, conversationId } = await setupConversation();
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ body: `Message ${i}` });
    }

    const res = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages?page=1&limit=2`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 5 });
  });

  it("tracks unread state and mark-as-read clears it for the reader only", async () => {
    const { customerToken, vendorToken, conversationId } = await setupConversation();

    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Hello?" });

    const beforeRead = await request(app)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(beforeRead.body.data.conversations[0]._count.messages).toBe(1);

    const markRead = await request(app)
      .patch(`/api/v1/conversations/${conversationId}/read`)
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(markRead.status).toBe(200);

    const afterRead = await request(app)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${vendorToken}`);
    expect(afterRead.body.data.conversations[0]._count.messages).toBe(0);
  });
});
