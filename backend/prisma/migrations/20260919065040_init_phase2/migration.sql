-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'VENDOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PortfolioMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT NOT NULL,
    "locality" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "categoryId" TEXT,
    "startingPrice" INTEGER,
    "yearsExperience" INTEGER,
    "eventsCompleted" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_portfolio" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "PortfolioMediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "title" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_packages" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_package_items" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "weddingDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "guestCount" INTEGER,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_event_categories" (
    "id" TEXT NOT NULL,
    "weddingEventId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wedding_event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_vendors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_categories_slug_key" ON "vendor_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_userId_key" ON "vendors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_slug_key" ON "vendors"("slug");

-- CreateIndex
CREATE INDEX "vendors_categoryId_idx" ON "vendors"("categoryId");

-- CreateIndex
CREATE INDEX "vendors_city_idx" ON "vendors"("city");

-- CreateIndex
CREATE INDEX "vendors_locality_idx" ON "vendors"("locality");

-- CreateIndex
CREATE INDEX "vendors_verificationStatus_idx" ON "vendors"("verificationStatus");

-- CreateIndex
CREATE INDEX "vendors_isActive_idx" ON "vendors"("isActive");

-- CreateIndex
CREATE INDEX "vendors_startingPrice_idx" ON "vendors"("startingPrice");

-- CreateIndex
CREATE INDEX "vendor_portfolio_vendorId_idx" ON "vendor_portfolio"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_packages_vendorId_idx" ON "vendor_packages"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_package_items_packageId_idx" ON "vendor_package_items"("packageId");

-- CreateIndex
CREATE INDEX "wedding_events_userId_idx" ON "wedding_events"("userId");

-- CreateIndex
CREATE INDEX "wedding_events_weddingDate_idx" ON "wedding_events"("weddingDate");

-- CreateIndex
CREATE INDEX "wedding_event_categories_weddingEventId_idx" ON "wedding_event_categories"("weddingEventId");

-- CreateIndex
CREATE INDEX "wedding_event_categories_categoryId_idx" ON "wedding_event_categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "wedding_event_categories_weddingEventId_categoryId_key" ON "wedding_event_categories"("weddingEventId", "categoryId");

-- CreateIndex
CREATE INDEX "favorite_vendors_userId_idx" ON "favorite_vendors"("userId");

-- CreateIndex
CREATE INDEX "favorite_vendors_vendorId_idx" ON "favorite_vendors"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_vendors_userId_vendorId_key" ON "favorite_vendors"("userId", "vendorId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_portfolio" ADD CONSTRAINT "vendor_portfolio_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_packages" ADD CONSTRAINT "vendor_packages_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_package_items" ADD CONSTRAINT "vendor_package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "vendor_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_events" ADD CONSTRAINT "wedding_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_event_categories" ADD CONSTRAINT "wedding_event_categories_weddingEventId_fkey" FOREIGN KEY ("weddingEventId") REFERENCES "wedding_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_event_categories" ADD CONSTRAINT "wedding_event_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "vendor_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_vendors" ADD CONSTRAINT "favorite_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
