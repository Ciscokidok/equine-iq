-- CreateTable
CREATE TABLE "RacingEarnings" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "totalEarningsCents" BIGINT NOT NULL DEFAULT 0,
    "starts" INTEGER,
    "wins" INTEGER,
    "places" INTEGER,
    "shows" INTEGER,
    "bestRaceClass" TEXT,
    "notes" TEXT,
    "sourceUrl" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RacingEarnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCost" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RacingEarnings_horseId_key" ON "RacingEarnings"("horseId");

-- CreateIndex
CREATE INDEX "ProductionCost_horseId_idx" ON "ProductionCost"("horseId");

-- CreateIndex
CREATE INDEX "ProductionCost_userId_idx" ON "ProductionCost"("userId");

-- AddForeignKey
ALTER TABLE "RacingEarnings" ADD CONSTRAINT "RacingEarnings_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCost" ADD CONSTRAINT "ProductionCost_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
