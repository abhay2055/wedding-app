-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'BLOCKED', 'BOOKED');

-- CreateTable
CREATE TABLE "vendor_availability" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_availability_vendorId_date_idx" ON "vendor_availability"("vendorId", "date");

-- CreateIndex
CREATE INDEX "vendor_availability_date_status_idx" ON "vendor_availability"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_availability_vendorId_date_key" ON "vendor_availability"("vendorId", "date");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminId_idx" ON "admin_audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "vendor_availability" ADD CONSTRAINT "vendor_availability_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
