# PERFORMANCE_AUDIT.md

Performance audit of the ORABI restaurant e-commerce application.
Captured: 2026-08-09 against the PostgreSQL stack (Postgres + Redis cache + BullMQ workers) at ~100+ products / 24 categories / small order set.

> Stack note: the source prompt mandates Supabase/PostgreSQL. The app now runs entirely on
> **PostgreSQL** (Mongoose/MongoDB removed). Redis is a cache layer, BullMQ drives email +
> analytics rollups, and k6 (container-only) runs the load scenarios. Nothing here weakens
> authn/z, validation, or correctness.

## Measurement approach

- **Latency**: in-app middleware (`server/src/middlewares/diagnostics.ts`) records per-route
  p50/p90/p95/p99 with a 60s rolling window; `perfSummaryTimer` logs every 60s and on shutdown.
- **Query plans**: run `EXPLAIN (ANALYZE)` against the live database for the hot queries
  (all are plain parameterized SQL in `server/src/db/*.ts`).
- **Load numbers**: k6 scenarios in `k6/` — see `docs/LOAD_TESTS.md` for commands and results.
- **Dataset**: current catalog is small (~100 products). Numbers are favorable; the audit
  focuses on *patterns* that degrade as data grows (1k→10k+).

## Hot queries (PostgreSQL)

| Query | Access path | Note |
|---|---|---|
| product by slug | index on `products.slug` | unique slug index |
| products list (filter/sort/page) | index on `products (isAvailable)` + sort keys | `LIMIT/OFFSET` pagination |
| bestsellers / offers | same filtered index, `LIMIT 10` | reads only returned rows |
| product search | `ILIKE '%…%'` on name/nameEn | sequential scan by design at this size (F2) |
| reviews by product | `reviews (productId, isApproved, createdAt)` | served from index |
| order history by user | `orders (userId, createdAt)` | paginated |
| dashboard | `analytics` daily rollup rows (1 row/day) | no full-table aggregates on request |

All list/review/history endpoints are paginated (default 10-12, max 50).

## Findings

### F1 — Unindexed hot collection scans (products) — done
`products:list`, `bestsellers`, and `offers` used to scan every product row. The migration
ships indexes on the filter/flag/sort columns (`isAvailable`, `isBestSeller`, `isOffer`,
`categoryId`, `rating`, `createdAt`) so these queries read ≈ returned rows.

### F2 — Regex/ILIKE search does not use an index — pending
`listProducts` uses `ILIKE '%…%'` on name + nameEn. Trivial at ~100 rows; the growth path is
`pg_trgm` GIN indexes on the search columns once the catalog exceeds a few thousand rows.
Scoped search (name/nameEn first, then widen) is already in place.

### F3 — Unbounded order history — done
`order.controller.ts:history` was unbounded; now paginated (`page/limit`, default 10, max 50)
with `{ items, total, page, pages, limit }` and an `orders (userId, createdAt)` index.

### F4 — Unbounded reviews list — done
`review.controller.ts:listByProduct` is paginated and the public endpoint filters
`isApproved = true`; index on `(productId, isApproved, createdAt)` serves sort + filter.

### F5 — Dashboard runs 12 concurrent full-table aggregates — done
The dashboard previously fired a dozen aggregates per load. Now the nightly-safe rollup job
(`analyticsRepo.rollupDailyStats(30)`, BullMQ cron `*/15 * * * *` UTC) maintains daily rows and
the dashboard reads them, then caches the assembled payload in Redis for 60s.

### F6 — No server-side response cache — done
Public endpoints (products, bestsellers, offers, categories, banners, branches, settings,
posts, dashboard) use the `cached()` Redis cache-aside middleware (60-300s TTL) with
`invalidateCache()` on writes. Client TanStack caching remains for interactive UX.

### F7 — Emails sent fire-and-forget — done
`createOrder` / `forgotPassword` / `register` enqueue into the BullMQ `orabi-email` queue
(concurrency 3, retries + backoff). If Redis is down the inline fallback sends synchronously;
with no SMTP configured, emails log to the console (`[MAIL:dev]`) for development.

### F8 — No transactions — done
PostgreSQL gives ACID transactions and row-level correctness: order placement is a single
transaction (`ordersRepo.placeOrder`), coupon redemptions are guarded by
`countRedemptionsForUser`, analytics bump/rollup uses `ON CONFLICT` upserts, and
`generateOrderNo` collisions retry on `23505`.

## Endpoint latency snapshot

Captured by the k6 load scenarios — see `docs/LOAD_TESTS.md` for commands, thresholds
(p95 < 300 ms public reads, < 1 s checkout/admin), and per-run summary results. The
diagnostics middleware logs per-route p-values every 60s for live observation.

| Endpoint | avg ms | p50 | p90 | p95 | p99 |
|---|---|---|---|---|---|
| GET /api/v1/products | k6 | k6 | k6 | k6 | k6 |
| GET /api/v1/products/:slug | k6 | k6 | k6 | k6 | k6 |
| GET /api/v1/categories/tree | k6 | k6 | k6 | k6 | k6 |
| GET /api/v1/offers/active | k6 | k6 | k6 | k6 | k6 |
| GET /api/v1/branches | k6 | k6 | k6 | k6 | k6 |
| POST /api/v1/orders | k6 | k6 | k6 | k6 | k6 |
| GET /api/v1/analytics/dashboard | k6 | k6 | k6 | k6 | k6 |

## Optimization register

| # | Problem | Fix | Status |
|---|---|---|---|
| F1 | scan on public product queries | PostgreSQL indexes on filter/sort columns | done |
| F2 | ILIKE search unindexed | scoped search; `pg_trgm` GIN documented as growth path | pending |
| F3 | unbounded order history | pagination + `(userId, createdAt)` index | done |
| F4 | unbounded reviews | pagination + `(productId, isApproved, createdAt)` index | done |
| F5 | 12 aggregates per dashboard | daily rollup (BullMQ cron) + Redis-cached payload | done |
| F6 | no server cache | Redis cache-aside on public endpoints | done |
| F7 | fire-and-forget email | BullMQ `orabi-email` queue with retry/backoff | done |
| F8 | no transactions | PostgreSQL transactions + guarded redemptions | done |
