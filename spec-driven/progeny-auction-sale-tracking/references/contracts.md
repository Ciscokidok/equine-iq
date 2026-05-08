# API Contracts: progeny-auction-sale-tracking

API contract definitions for new and modified endpoints.

---

## POST /api/foals/:id/auction-sales

Record an auction sale for an existing foal.

**Auth**: Required (`requireAuth`)

**Request body**:
```json
{
  "salePrice": 150000,
  "saleDate": "2025-09-15",
  "saleType": "yearling",
  "auctionHouse": "Keeneland September",
  "hipNumber": "342",
  "buyer": "Donohue Bloodstock",
  "notes": "Sold on opening day"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| salePrice | number | Yes | Must be > 0 |
| saleDate | string (ISO date) | Yes | Parsed to DateTime |
| saleType | enum | Yes | `weanling` \| `yearling` \| `two_year_old_in_training` \| `mixed_age` |
| auctionHouse | string | No | |
| hipNumber | string | No | |
| buyer | string | No | |
| notes | string | No | |

**Response (201)**:
```json
{
  "id": "uuid",
  "foalId": "uuid",
  "userId": "uuid",
  "salePrice": 150000,
  "saleDate": "2025-09-15T00:00:00.000Z",
  "saleType": "yearling",
  "auctionHouse": "Keeneland September",
  "hipNumber": "342",
  "buyer": "Donohue Bloodstock",
  "notes": "Sold on opening day",
  "createdAt": "2026-05-08T12:00:00.000Z"
}
```

**Errors**:
- `400` — validation failure (salePrice ≤ 0, missing required fields)
- `404` — foal not found or not owned by requesting user

---

## GET /api/foals/:id/auction-sales

List all auction sales for a foal, ordered by saleDate descending.

**Auth**: Required

**Response (200)**:
```json
[
  {
    "id": "uuid",
    "foalId": "uuid",
    "salePrice": 150000,
    "saleDate": "2025-09-15T00:00:00.000Z",
    "saleType": "yearling",
    "auctionHouse": "Keeneland September",
    "hipNumber": "342",
    "buyer": "Donohue Bloodstock",
    "notes": null,
    "createdAt": "2026-05-08T12:00:00.000Z"
  }
]
```

Returns `[]` (empty array) when no sales exist — not an error.

**Errors**:
- `404` — foal not found or not owned by requesting user

---

## GET /foals/:id (modified — extended include)

The existing foal detail endpoint is modified to include `auctionSales` in the response.

**Response augmentation**:
```json
{
  "id": "uuid",
  "name": "Valor's Hope",
  "sex": "stallion",
  "foaledAt": "2023-03-12T00:00:00.000Z",
  "auctionSales": [
    {
      "id": "uuid",
      "salePrice": 150000,
      "saleDate": "2025-09-15T00:00:00.000Z",
      "saleType": "yearling",
      "auctionHouse": "Keeneland September"
    }
  ]
}
```

---

## GET /api/stallions/:id/auction-sale-stats

Aggregate auction sale stats for a stallion's progeny. Optionally scoped to a specific mare cross.

**Auth**: Required

**Query parameters**:
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| mareId | string (UUID) | No | If provided, scopes stats to the stallion × mare combination (FR-4) |

**Response (200) — with data**:
```json
{
  "stallionId": "uuid",
  "mareId": null,
  "count": 5,
  "avg": 145000,
  "median": 135000,
  "high": 220000,
  "low": 85000,
  "lowSampleWarning": false
}
```

`lowSampleWarning: true` when `count < 3` (FR-4, AC-4.2).

**Response (200) — no data**:
```json
{
  "stallionId": "uuid",
  "mareId": null,
  "count": 0,
  "avg": null,
  "median": null,
  "high": null,
  "low": null,
  "lowSampleWarning": false
}
```

Returns 200 with null aggregates — never 404 — when no sales exist (AC-3.2).

**Errors**:
- `404` — stallion not found

---

## POST /api/pairings/analyze (modified — progenySaleStats added)

The existing analyze endpoint is augmented to include per-stallion sale stats in each result.

**Response augmentation** (each element of `results` array):
```json
{
  "stallion": { "id": "uuid", "name": "Northern Dancer II", ... },
  "compatibility_score": 87.5,
  "reasoning": "...",
  "risk_flags": [],
  "top_strengths": ["Correct conformation", "Complementary bloodlines"],
  "considerations": [],
  "progenySaleStats": {
    "avg": 145000,
    "count": 5
  }
}
```

`progenySaleStats` is `null` when the stallion has no recorded auction sales in the user's account (AC-5.2).

---

## Prisma Schema Addition

```prisma
enum AuctionSaleType {
  weanling
  yearling
  two_year_old_in_training
  mixed_age
}

model AuctionSale {
  id           String          @id @default(uuid())
  foalId       String
  userId       String
  salePrice    Float
  saleDate     DateTime
  saleType     AuctionSaleType
  auctionHouse String?
  hipNumber    String?
  buyer        String?
  notes        String?
  createdAt    DateTime        @default(now())

  foal Foal @relation(fields: [foalId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([foalId])
  @@index([userId])
  @@index([userId, saleDate])
}
```

Note: `Foal` model requires an `auctionSales AuctionSale[]` relation field. `User` model requires an `auctionSales AuctionSale[]` relation field.

---

## Stats Utility Interface

```typescript
// api/src/lib/auctionSaleStats.ts

export interface SaleStats {
  stallionId: string
  mareId: string | null
  count: number
  avg: number | null
  median: number | null
  high: number | null
  low: number | null
  lowSampleWarning: boolean
}

export interface BulkSaleStat {
  avg: number
  count: number
}

export async function getStallionSaleStats(
  stallionId: string,
  userId: string,
  mareId?: string
): Promise<SaleStats>

export async function getBulkSaleStats(
  stallionIds: string[],
  userId: string
): Promise<Map<string, BulkSaleStat>>
```
