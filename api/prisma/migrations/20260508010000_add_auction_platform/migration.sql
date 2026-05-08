-- AlterTable: Add role to User
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'scheduled', 'open', 'closed', 'seller_deciding', 'counter_offering', 'sold', 'passed');

-- CreateEnum
CREATE TYPE "ReserveBehavior" AS ENUM ('auto_pass', 'seller_decision', 'counter_offer');

-- CreateEnum
CREATE TYPE "BidderApprovalStatus" AS ENUM ('pending', 'approved', 'suspended');

-- CreateEnum
CREATE TYPE "AuctionSource" AS ENUM ('internal', 'bidpath', 'keeneland', 'fasig_tipton', 'obs');

-- CreateEnum
CREATE TYPE "VettingDocType" AS ENUM ('coggins_test', 'vet_certificate', 'registration_papers', 'radiographs', 'endoscopy_video');

-- CreateEnum
CREATE TYPE "VettingDocScanStatus" AS ENUM ('pending_scan', 'clean', 'rejected');

-- CreateTable
CREATE TABLE "AuctionListing" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'pending_review',
    "reservePrice" INTEGER,
    "reserveBehavior" "ReserveBehavior" NOT NULL DEFAULT 'auto_pass',
    "buyersPremiumPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "notes" TEXT,
    "vetApprovedAt" TIMESTAMP(3),
    "vetRejectedAt" TIMESTAMP(3),
    "vetRejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuctionListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VettingDocument" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "docType" "VettingDocType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "scanStatus" "VettingDocScanStatus" NOT NULL DEFAULT 'pending_scan',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VettingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'scheduled',
    "startingBid" INTEGER NOT NULL,
    "bidIncrement" INTEGER NOT NULL DEFAULT 100,
    "currentBid" INTEGER NOT NULL DEFAULT 0,
    "highBidderId" TEXT,
    "highGuestBidderId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "sellerDecisionDeadline" TIMESTAMP(3),
    "paymentConfirmedAt" TIMESTAMP(3),
    "auctionSource" "AuctionSource" NOT NULL DEFAULT 'internal',
    "externalLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT,
    "guestBidderId" TEXT,
    "amount" INTEGER NOT NULL,
    "isAutoBid" BOOLEAN NOT NULL DEFAULT false,
    "autoMaxAmount" INTEGER,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidderApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestBidderId" TEXT,
    "status" "BidderApprovalStatus" NOT NULL DEFAULT 'pending',
    "depositAmount" INTEGER,
    "depositReference" TEXT,
    "depositConfirmedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BidderApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestBidder" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "verifyExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestBidder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionWatcher" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuctionWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdapterConfig" (
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdapterConfig_pkey" PRIMARY KEY ("source")
);

-- CreateIndex
CREATE INDEX "AuctionListing_sellerId_idx" ON "AuctionListing"("sellerId");
CREATE INDEX "AuctionListing_status_idx" ON "AuctionListing"("status");
CREATE UNIQUE INDEX "Auction_listingId_key" ON "Auction"("listingId");
CREATE INDEX "Auction_status_idx" ON "Auction"("status");
CREATE INDEX "Auction_auctionSource_externalLotId_idx" ON "Auction"("auctionSource", "externalLotId");
CREATE INDEX "Bid_auctionId_idx" ON "Bid"("auctionId");
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");
CREATE UNIQUE INDEX "BidderApproval_userId_key" ON "BidderApproval"("userId");
CREATE UNIQUE INDEX "BidderApproval_guestBidderId_key" ON "BidderApproval"("guestBidderId");
CREATE UNIQUE INDEX "GuestBidder_email_key" ON "GuestBidder"("email");
CREATE UNIQUE INDEX "GuestBidder_verifyToken_key" ON "GuestBidder"("verifyToken");
CREATE INDEX "VettingDocument_listingId_idx" ON "VettingDocument"("listingId");
CREATE UNIQUE INDEX "AuctionWatcher_auctionId_userId_key" ON "AuctionWatcher"("auctionId", "userId");
CREATE UNIQUE INDEX "AuctionWatcher_auctionId_email_key" ON "AuctionWatcher"("auctionId", "email");
CREATE INDEX "AuctionWatcher_auctionId_idx" ON "AuctionWatcher"("auctionId");

-- AddForeignKey
ALTER TABLE "AuctionListing" ADD CONSTRAINT "AuctionListing_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuctionListing" ADD CONSTRAINT "AuctionListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VettingDocument" ADD CONSTRAINT "VettingDocument_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AuctionListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AuctionListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_highBidderId_fkey" FOREIGN KEY ("highBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_highGuestBidderId_fkey" FOREIGN KEY ("highGuestBidderId") REFERENCES "GuestBidder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_guestBidderId_fkey" FOREIGN KEY ("guestBidderId") REFERENCES "GuestBidder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BidderApproval" ADD CONSTRAINT "BidderApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BidderApproval" ADD CONSTRAINT "BidderApproval_guestBidderId_fkey" FOREIGN KEY ("guestBidderId") REFERENCES "GuestBidder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionWatcher" ADD CONSTRAINT "AuctionWatcher_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionWatcher" ADD CONSTRAINT "AuctionWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
