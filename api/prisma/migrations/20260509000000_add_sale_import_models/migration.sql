-- CreateEnum
CREATE TYPE "DataProvider" AS ENUM ('sporthorse_data', 'equibase', 'tjcis');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('csv', 'api');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "SaleRecord" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "saleSource" TEXT NOT NULL,
    "saleSessionName" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "hipNumber" TEXT,
    "hammerPriceCents" INTEGER NOT NULL,
    "buyerName" TEXT,
    "consignorName" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "provider" "DataProvider",
    "sourceFileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'processing',
    "errorLog" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProviderConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "DataProvider" NOT NULL,
    "encryptedCredential" TEXT NOT NULL,
    "testStatus" TEXT,
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformProviderConfig" (
    "provider" "DataProvider" NOT NULL,
    "encryptedCredential" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformProviderConfig_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE INDEX "SaleRecord_horseId_idx" ON "SaleRecord"("horseId");

-- CreateIndex
CREATE INDEX "SaleRecord_importBatchId_idx" ON "SaleRecord"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleRecord_horseId_hipNumber_saleDate_key" ON "SaleRecord"("horseId", "hipNumber", "saleDate");

-- CreateIndex
CREATE INDEX "ImportBatch_importedByUserId_idx" ON "ImportBatch"("importedByUserId");

-- CreateIndex
CREATE INDEX "UserProviderConfig_userId_idx" ON "UserProviderConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProviderConfig_userId_provider_key" ON "UserProviderConfig"("userId", "provider");

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleRecord" ADD CONSTRAINT "SaleRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProviderConfig" ADD CONSTRAINT "UserProviderConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
