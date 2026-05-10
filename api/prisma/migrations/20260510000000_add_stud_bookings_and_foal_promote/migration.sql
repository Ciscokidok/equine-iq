-- CreateEnum
CREATE TYPE "StudBookingStatus" AS ENUM ('pending_payment', 'confirmed', 'breeding_complete', 'cancelled');

-- AlterTable
ALTER TABLE "Foal" ADD COLUMN "promotedHorseId" TEXT UNIQUE;

-- CreateTable
CREATE TABLE "StudBooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mareId" TEXT NOT NULL,
    "stallionId" TEXT NOT NULL,
    "feePaidCents" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "status" "StudBookingStatus" NOT NULL DEFAULT 'pending_payment',
    "scheduledDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudBooking_stripeSessionId_key" ON "StudBooking"("stripeSessionId");

-- CreateIndex
CREATE INDEX "StudBooking_userId_idx" ON "StudBooking"("userId");

-- AddForeignKey
ALTER TABLE "StudBooking" ADD CONSTRAINT "StudBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudBooking" ADD CONSTRAINT "StudBooking_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudBooking" ADD CONSTRAINT "StudBooking_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
