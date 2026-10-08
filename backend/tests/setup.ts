import { prisma } from "../src/config/prisma";

// Runs against the database pointed to by DATABASE_URL when the test
// process starts (see .env.test.example) - never the dev database.
// Deleted in FK-dependency order; onDelete: Cascade handles most of this
// already, but being explicit keeps every test suite's data isolated.
beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bookingCounter.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.favoriteVendor.deleteMany();
  await prisma.weddingEventCategory.deleteMany();
  await prisma.weddingEvent.deleteMany();
  await prisma.vendorPackageItem.deleteMany();
  await prisma.vendorPackage.deleteMany();
  await prisma.vendorPortfolio.deleteMany();
  await prisma.vendorAvailability.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.vendorCategory.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
