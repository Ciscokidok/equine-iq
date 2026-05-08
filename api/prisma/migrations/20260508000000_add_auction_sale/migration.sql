-- CreateEnum
CREATE TYPE "AuctionSaleType" AS ENUM ('weanling', 'yearling', 'two_year_old_in_training', 'mixed_age');

-- CreateTable
CREATE TABLE "AuctionSale" (
    "id" TEXT NOT NULL,
    "foalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "saleType" "AuctionSaleType" NOT NULL,
    "auctionHouse" TEXT,
    "hipNumber" TEXT,
    "buyer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionSale_foalId_idx" ON "AuctionSale"("foalId");

-- CreateIndex
CREATE INDEX "AuctionSale_userId_idx" ON "AuctionSale"("userId");

-- CreateIndex
CREATE INDEX "AuctionSale_userId_saleDate_idx" ON "AuctionSale"("userId", "saleDate");

-- AddForeignKey
ALTER TABLE "AuctionSale" ADD CONSTRAINT "AuctionSale_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Foal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionSale" ADD CONSTRAINT "AuctionSale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
