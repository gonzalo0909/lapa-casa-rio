-- Actualizar tabla payments con campos adicionales
ALTER TABLE "payments" ADD COLUMN "transactionId" TEXT;
ALTER TABLE "payments" ADD COLUMN "gateway" TEXT;
ALTER TABLE "payments" ADD COLUMN "gatewayFee" DECIMAL(8,2);
ALTER TABLE "payments" ADD COLUMN "netAmount" DECIMAL(10,2);
ALTER TABLE "payments" ADD COLUMN "refundedAmount" DECIMAL(10,2);
ALTER TABLE "payments" ADD COLUMN "metadata" JSONB;
ALTER TABLE "payments" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "payments" ADD COLUMN "webhookReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Actualizar enum PaymentStatus
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- Actualizar enum PaymentMethod
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_DEPOSIT';

-- Crear tabla email_logs
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- Actualizar tabla holds con metadata
ALTER TABLE "holds" ADD COLUMN "metadata" JSONB;

-- Crear índices para performance
CREATE INDEX "email_logs_booking_id_idx" ON "email_logs"("bookingId");
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");
CREATE INDEX "payments_booking_id_idx" ON "payments"("bookingId");
CREATE INDEX "payments_external_id_idx" ON "payments"("externalId");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_method_idx" ON "payments"("method");
