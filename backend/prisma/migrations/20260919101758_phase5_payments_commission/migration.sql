-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProviderName" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'BALANCE', 'REFUND');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPLIED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookProcessStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "advancePaidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED';

-- AlterTable
ALTER TABLE "vendor_packages" ADD COLUMN     "advancePercentage" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "provider" "PaymentProviderName" NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "providerSignature" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "paymentType" "PaymentType" NOT NULL DEFAULT 'ADVANCE',
    "refundOfPaymentId" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentProviderName" NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL DEFAULT 'PERCENTAGE',
    "percentage" INTEGER,
    "grossAmount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "vendorAmount" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'APPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderName" NOT NULL DEFAULT 'RAZORPAY',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookProcessStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerOrderId_key" ON "payments"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerPaymentId_key" ON "payments"("providerPaymentId");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_customerId_idx" ON "payments"("customerId");

-- CreateIndex
CREATE INDEX "payments_vendorId_idx" ON "payments"("vendorId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payment_attempts_paymentId_idx" ON "payment_attempts"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_paymentId_key" ON "commissions"("paymentId");

-- CreateIndex
CREATE INDEX "commissions_vendorId_idx" ON "commissions"("vendorId");

-- CreateIndex
CREATE INDEX "commissions_bookingId_idx" ON "commissions"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_providerEventId_key" ON "payment_webhook_events"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_refundOfPaymentId_fkey" FOREIGN KEY ("refundOfPaymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
