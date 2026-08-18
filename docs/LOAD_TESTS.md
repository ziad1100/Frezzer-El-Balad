# LOAD_TESTS.md

Load-testing guide for the ORABI API using k6 (container image only — no local install).

## Prerequisites

- Docker (runs the `grafana/k6` image).
- API running with data seeded (`npm run seed`).
- **Start the API with `DISABLE_RATE_LIMIT=1`** — the auth limiter (20/15 min) and API
  limiter (300/15 min) are deliberately bypassed in dev/load mode so checks aren't throttled.
  From the API directory: `cross-env DISABLE_RATE_LIMIT=1 npm run dev:server`.
- Admin seed account exists: `admin@pizzahouse.dev` / `Pizza123!` (override via env).

## Scenarios

| Script | Workload | Endpoints | Thresholds |
|---|---|---|---|
| `k6/catalog.js` | read-heavy browsing, 20 req/s constant rate, 60 s | products list, best-sellers, offers, offers/active, categories/tree, banners/active, product by slug | `http_req_failed < 1%`, p95 < 300 ms, p99 < 1 s |
| `k6/order.js` | checkout, 5 VUs x 2 iterations | auth/register, orders create, orders/history | `http_req_failed < 1%`, p95 < 1 s, p99 < 2 s |
| `k6/dashboard.js` | admin reads, 3 VUs x 3 iterations | auth/login, analytics/dashboard, orders/stats, products/admin, admin/users | `http_req_failed < 1%`, p95 < 500 ms, p99 < 1 s |

`catalog.js` picks product slugs from a setup-phase product listing, so it exercises
real catalog data without hardcoding IDs.

## Running (Windows PowerShell)

The container resolves the host API via `host.docker.internal`; on Linux Docker replace it
with `localhost`.

```powershell
docker run --rm -i -v "${PWD}\k6:/k6" -e BASE_URL=http://host.docker.internal:5000 grafana/k6 run /k6/catalog.js
docker run --rm -i -v "${PWD}\k6:/k6" -e BASE_URL=http://host.docker.internal:5000 grafana/k6 run /k6/order.js
docker run --rm -i -v "${PWD}\k6:/k6" -e BASE_URL=http://host.docker.internal:5000 grafana/k6 run /k6/dashboard.js
```

The first invocation pulls the `grafana/k6` image. Exit code 0 = thresholds passed; nonzero =
threshold failure (CI-friendly).

## Reading the results

- **scenario summary**: `checks`, `http_req_duration` (avg/p50/p90/p95/p99), `http_req_failed`.
- **per-endpoint**: add tags (`check`/`tag` by URL) for per-route thresholds.
- The API's own `perfSummaryTimer` logs per-route p-values every 60 s.

## Notes

- `order.js` registers a fresh unique user per iteration, placing real orders in the dev DB;
  they accumulate — clear with `npm run restore:db` / the admin panel, or point `BASE_URL`
  at a scratch environment.
- `dashboard.js` re-logs in per 1 s — with the limiter on this would trip the 20/15-min
  auth cap; that is why `DISABLE_RATE_LIMIT=1` is required.
- These are the same scenarios referenced by `docs/PERFORMANCE_AUDIT.md` — record the
  summary output next to the endpoint table after each run.