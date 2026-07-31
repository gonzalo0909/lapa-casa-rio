-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('MIXED', 'FEMALE', 'MALE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('ACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'REMAINING', 'FULL', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "roomCode" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'MIXED',
    "isFlexible" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "amenities" JSONB,
    "images" JSONB,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "autoConvertHours" SMALLINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedNumber" SMALLINT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_assignments" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingNumber" VARCHAR(20) NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bedsCount" SMALLINT NOT NULL,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "nightsCount" SMALLINT NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "groupDiscount" DECIMAL(5,4) NOT NULL,
    "seasonMultiplier" DECIMAL(5,4) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "depositPercent" DECIMAL(5,4) NOT NULL,
    "remainingAmount" DECIMAL(10,2) NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositPaidAt" TIMESTAMP(3),
    "remainingPaid" BOOLEAN NOT NULL DEFAULT false,
    "remainingPaidAt" TIMESTAMP(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "specialRequests" TEXT,
    "internalNotes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "refundAmount" DECIMAL(10,2),
    "sheetsSynced" BOOLEAN NOT NULL DEFAULT false,
    "sheetsSyncedAt" TIMESTAMP(3),
    "sheetsRowNumber" INTEGER,
    "source" VARCHAR(50),
    "userAgent" TEXT,
    "ipAddress" VARCHAR(45),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" TEXT NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "alternativePhone" VARCHAR(20),
    "whatsappNumber" VARCHAR(20),
    "nationality" VARCHAR(50),
    "language" VARCHAR(10),
    "dateOfBirth" DATE,
    "documentType" VARCHAR(20),
    "documentNumber" VARCHAR(50),
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lastBookingAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" VARCHAR(30) NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "paymentType" "PaymentType" NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "paymentMethod" VARCHAR(50) NOT NULL,
    "cardBrand" VARCHAR(20),
    "cardLast4" VARCHAR(4),
    "installments" SMALLINT,
    "installmentAmount" DECIMAL(10,2),
    "stripePaymentIntentId" VARCHAR(255),
    "stripeChargeId" VARCHAR(255),
    "mpPaymentId" VARCHAR(255),
    "mpPreferenceId" VARCHAR(255),
    "pixQrCode" TEXT,
    "pixQrCodeBase64" TEXT,
    "pixExpiresAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "failureCode" VARCHAR(50),
    "refundAmount" DECIMAL(10,2),
    "refundReason" TEXT,
    "retryAttempts" SMALLINT NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "metadata" JSONB,
    "webhookData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_availability" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCapacity" SMALLINT NOT NULL,
    "availableBeds" SMALLINT NOT NULL,
    "occupiedBeds" SMALLINT NOT NULL DEFAULT 0,
    "blockedBeds" SMALLINT NOT NULL DEFAULT 0,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "seasonMultiplier" DECIMAL(5,4) NOT NULL,
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "minStay" SMALLINT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "userId" VARCHAR(50),
    "userEmail" VARCHAR(255),
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_roomCode_key" ON "rooms"("roomCode");

-- CreateIndex
CREATE INDEX "rooms_roomCode_idx" ON "rooms"("roomCode");

-- CreateIndex
CREATE INDEX "rooms_type_idx" ON "rooms"("type");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE INDEX "beds_roomId_idx" ON "beds"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "beds_roomId_bedNumber_key" ON "beds"("roomId", "bedNumber");

-- CreateIndex
CREATE INDEX "bed_assignments_bedId_idx" ON "bed_assignments"("bedId");

-- CreateIndex
CREATE INDEX "bed_assignments_bookingId_idx" ON "bed_assignments"("bookingId");

-- CreateIndex
CREATE INDEX "bed_assignments_checkInDate_checkOutDate_idx" ON "bed_assignments"("checkInDate", "checkOutDate");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingNumber_key" ON "bookings"("bookingNumber");

-- CreateIndex
CREATE INDEX "bookings_bookingNumber_idx" ON "bookings"("bookingNumber");

-- CreateIndex
CREATE INDEX "bookings_guestId_idx" ON "bookings"("guestId");

-- CreateIndex
CREATE INDEX "bookings_roomId_idx" ON "bookings"("roomId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_checkInDate_idx" ON "bookings"("checkInDate");

-- CreateIndex
CREATE INDEX "bookings_checkOutDate_idx" ON "bookings"("checkOutDate");

-- CreateIndex
CREATE INDEX "bookings_checkInDate_checkOutDate_idx" ON "bookings"("checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "bookings_createdAt_idx" ON "bookings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "guests_email_key" ON "guests"("email");

-- CreateIndex
CREATE INDEX "guests_email_idx" ON "guests"("email");

-- CreateIndex
CREATE INDEX "guests_phone_idx" ON "guests"("phone");

-- CreateIndex
CREATE INDEX "guests_lastName_firstName_idx" ON "guests"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNumber_key" ON "payments"("paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mpPaymentId_key" ON "payments"("mpPaymentId");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_provider_idx" ON "payments"("provider");

-- CreateIndex
CREATE INDEX "payments_paymentType_idx" ON "payments"("paymentType");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE INDEX "payments_stripePaymentIntentId_idx" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_mpPaymentId_idx" ON "payments"("mpPaymentId");

-- CreateIndex
CREATE INDEX "room_availability_date_idx" ON "room_availability"("date");

-- CreateIndex
CREATE INDEX "room_availability_roomId_date_idx" ON "room_availability"("roomId", "date");

-- CreateIndex
CREATE INDEX "room_availability_isAvailable_idx" ON "room_availability"("isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "room_availability_roomId_date_key" ON "room_availability"("roomId", "date");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "system_config"("key");

-- CreateIndex
CREATE INDEX "system_config_key_idx" ON "system_config"("key");

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_assignments" ADD CONSTRAINT "bed_assignments_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_assignments" ADD CONSTRAINT "bed_assignments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_availability" ADD CONSTRAINT "room_availability_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Anti-overbooking guarantee (hand-written: Prisma's schema language cannot
-- express EXCLUDE constraints, so this is added directly to the generated
-- migration). btree_gist lets a GiST index compare the plain equality
-- column (bedId) alongside the range overlap check in a single index.
--
-- This guarantees, at the database engine level, that two bed_assignments
-- rows can never exist for the same bed with overlapping date ranges --
-- enforced atomically by Postgres itself under any concurrency, not by
-- application code that could have a bug or a race condition.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bed_assignments" ADD CONSTRAINT "no_overlapping_bed_assignments"
  EXCLUDE USING gist (
    "bedId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  );

