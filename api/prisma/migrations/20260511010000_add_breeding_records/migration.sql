-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('bred', 'confirmed_in_foal', 'foaled', 'slipped', 'barren');

-- CreateTable
CREATE TABLE "Breeding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mareId" TEXT NOT NULL,
    "stallionId" TEXT NOT NULL,
    "bredDate" TIMESTAMP(3) NOT NULL,
    "status" "BreedingStatus" NOT NULL DEFAULT 'bred',
    "studFeeCents" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "expectedFoalDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breeding_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Foal" ADD COLUMN "breedingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Foal_breedingId_key" ON "Foal"("breedingId");

-- CreateIndex
CREATE INDEX "Breeding_userId_idx" ON "Breeding"("userId");

-- CreateIndex
CREATE INDEX "Breeding_mareId_idx" ON "Breeding"("mareId");

-- AddForeignKey
ALTER TABLE "Breeding" ADD CONSTRAINT "Breeding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breeding" ADD CONSTRAINT "Breeding_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Breeding" ADD CONSTRAINT "Breeding_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Foal" ADD CONSTRAINT "Foal_breedingId_fkey" FOREIGN KEY ("breedingId") REFERENCES "Breeding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
