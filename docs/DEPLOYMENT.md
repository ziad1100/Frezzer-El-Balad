# PRODUCTION DEPLOYMENT — Frezzer El Balad

Architecture: **Vercel frontend → Render backend → PostgreSQL database.**

```
GitHub: ziad1100/Frezzer-El-Balad
        ↓
Vercel — Frontend Only: https://frezzer-el-balad.vercel.app
        ↓  (VITE_API_URL → Authorization: Bearer token)
Render — Backend Only:  https://frezzer-el-balad.onrender.com
        ↓
Database: PostgreSQL (managed on Render)
```

- **Vercel** serves the React 19 + Vite 8 SPA. No serverless functions, no backend code.
- **Render** runs the Express + Node API via Docker. No frontend code.
- The browser never talks to PostgreSQL — everything goes through the API.
- CORS, RLS, RBAC, JWT, rate limiting, Helmet are all active.

---

## 1. Production URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | https://frezzer-el-balad.vercel.app |
| Backend (Render) | https://frezzer-el-balad.onrender.com |
| GitHub repo | https://github.com/ziad1100/Frezzer-El-Balad |
| Render dashboard | https://dashboard.render.com/web/srv-da4se6u417fc73dcnf00 |
| Vercel dashboard | https://vercel.com/ziad007/frezzer-el-balad |

---

## 2. Environment variables

### Frontend — Vercel

| Variable | Value | Environments |
|---|---|---|
| `VITE_API_URL` | `https://frezzer-el-balad.onrender.com` | Production, Preview, Development |

Configured via Vercel CLI: `npx vercel env add VITE_API_URL`.

### Backend — Render

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `10000` | Set by Render |
| `DATABASE_URL` | *(secret)* | Managed PostgreSQL on Render |
| `JWT_ACCESS_SECRET` | *(secret)* | ≥32 chars |
| `JWT_REFRESH_SECRET` | *(secret)* | ≥32 chars |
| `CLIENT_URL` | `https://frezzer-el-balad.vercel.app` | CORS origin + OAuth redirects |
| `COOKIE_SECURE` | `true` | Required for cross-domain cookies |
| `COOKIE_SAMESITE` | `none` | Required: frontend + backend on different domains |
| `PG_MAX_POOL_SIZE` | `10` | Free tier limit |
| `ADMIN_REGISTER_CODE` | *(secret)* | For registering new admin accounts |

> ⚠️ `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` must be set on the Render
> dashboard for the admin token refresh flow to work across domains.

---

## 3. CORS configuration

The backend allows exactly one public origin:

```
CLIENT_URL = https://frezzer-el-balad.vercel.app
```

Plus loopback/private-network origins (for LAN admin panel access).

CORS response headers verified:
```
access-control-allow-origin: https://frezzer-el-balad.vercel.app
access-control-allow-credentials: true
access-control-allow-methods: GET,POST,PATCH,PUT,DELETE,OPTIONS
access-control-allow-headers: Content-Type,Authorization
```

---

## 4. Cookie configuration

Since frontend and backend are on different domains (Vercel vs Render):

| Setting | Value | Why |
|---|---|---|
| `SameSite` | `none` | Cross-origin requests require this |
| `Secure` | `true` | Required when SameSite=none |
| `HttpOnly` | `true` | Prevents XSS access to tokens |

Cookies set on login:
- `accessToken` — 15 min lifetime, used via Authorization header
- `refreshToken` — 7 day lifetime, used via httpOnly cookie for silent refresh

---

## 5. Authentication flow

```
1. POST /api/v1/auth/login {email, password}
   → Returns {accessToken, user} + sets httpOnly cookies

2. Frontend stores accessToken in localStorage
   → Sends Authorization: Bearer <token> on all API requests

3. On 401 response:
   → Interceptor calls POST /api/v1/auth/refresh (sends refresh token cookie)
   → Gets new accessToken, retries original request

4. On refresh failure (401):
   → Clears stored token, redirects to /login
```

Admin route guard checks:
- Token exists in Redux store
- User role is `admin` or `manager`

---

## 6. Database migrations

Migrations run automatically on server boot via `applyMigrations()`.

| Migration | Purpose |
|---|---|
| 001_init.sql | Full schema: users, products, orders, reviews, etc. |
| 002_order_management.sql | Order status management |
| 003_reviews.sql | Review system |
| 004_products_sort_order.sql | Product ordering |
| 005_gallery_images.sql | Gallery image table |
| 006_quick_reviews.sql | Quick review system |
| 007_category_display_order.sql | Category ordering |
| 008_admin_account_settings.sql | Admin account settings |
| 009_backfill_images_offers_gallery.sql | Backfill product images, offer-product links, gallery |
| 010_fix_product_images.sql | Fix product images (array_length NULL issue) |
| 011_fix_blog_image_paths.sql | Fix blog post image paths |

All migrations are idempotent and tracked in `schema_migrations` table.

---

## 7. Seeded data

### Products (21 total)
All products have images from `public/images/products/`.

| Category | Products |
|---|---|
| Fresh Meat | Flank Meat, Steak Meat, Minced Meat |
| Liver | Beef Liver, American Liver |
| Sausage & Processed | Eastern Sausage, Sosis, Goulash, Baladi Kebab |
| Burger & Kofta | Burger, Baladi Burger, Kofta, Strips |
| Chicken | Wings, Shish |
| Ready Chicken | Pane, Mozzarella Pane |
| Hawawshi | Hawawshi, Chicken Hawawshi, Rice Hawawshi, Baladi Hawawshi |

### Offers (3 active)
| Offer | Discount | Products |
|---|---|---|
| Weekly Special | -50 EGP fixed | Steak Meat, Flank Meat, Minced Meat, Kofta, Hawawshi |
| Chicken Deals | -15% | Wings, Shish, Pane, Mozzarella Pane, Chicken Hawawshi |
| Family Deal | -40 EGP fixed | Hawawshi, Chicken Hawawshi, Baladi Hawawshi, Burger, Baladi Burger |

### Gallery (20 images)
All 20 product images are in the gallery.

### Coupons
| Code | Type | Value | Min Order |
|---|---|---|---|
| WELCOME20 | percent | 20% | 150 EGP |
| FREZZER10 | percent | 10% | 100 EGP |
| SAVE30 | fixed | 30 EGP | 250 EGP |

### Categories (7 sections, 8 sub-categories)
Meat, Liver, Sausage & Processed, Burger & Kofta, Chicken, Ready Chicken Products, Hawawshi

---

## 8. Admin credentials

| Account | Email | Password | Role |
|---|---|---|---|
| Admin | admin@frezzerelbalad.dev | Frezzer123! | admin |
| Manager | manager@frezzerelbalad.dev | Frezzer123! | manager |
| Employee | employee@frezzerelbalad.dev | Frezzer123! | employee |
| Customer | customer@frezzerelbalad.dev | Frezzer123! | customer |

> These credentials exist in development mode only. In production, admins register
> via `/register` using `ADMIN_REGISTER_CODE`.

---

## 9. Deployment procedure

### Frontend (Vercel)
1. Push to `main` on GitHub
2. Vercel auto-deploys from GitHub integration
3. Or manually: `npx vercel --prod --yes`

### Backend (Render)
1. Push to `main` on GitHub
2. Render auto-deploys from GitHub integration (Docker build)
3. On boot: migrations run, server starts on `$PORT`
4. Health check: `GET /health` → `{"status":"ok"}`

### First-time setup
1. Create Vercel project: `npx vercel link --project frezzer-el-balad --yes`
2. Set env vars: `npx vercel env add VITE_API_URL`
3. Deploy: `npx vercel --prod --yes`
4. On Render dashboard: set `CLIENT_URL`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`

---

## 10. Verification checklist

After any deployment, verify:

| Check | Endpoint/URL | Expected |
|---|---|---|
| Frontend loads | `GET /` | 200, HTML with React app |
| API health | `GET /health` | 200, `{"status":"ok"}` |
| Products load | `GET /api/v1/products` | 21 products with images |
| Best sellers | `GET /api/v1/products/best-sellers` | 10 products |
| Offers load | `GET /api/v1/offers/active` | 3 offers with products |
| Gallery loads | `GET /api/v1/gallery/public` | 20 images |
| Categories | `GET /api/v1/categories` | 7 sections, 8 subs |
| Product images | `GET /images/products/*.jpg` | 200 for all 21 images |
| Gallery images | `GET /images/blog/*.jpg` | 200 for dough.jpg, feteer.jpg |
| CORS | OPTIONS with Origin header | `access-control-allow-origin` matches |
| Admin login | POST /auth/login | 200, role=admin |
| Token refresh | POST /auth/refresh | 200, new accessToken |
| Customer checkout | POST /auth/login → POST /cart/items → POST /orders | Order created |

---

## 11. Architecture decisions

| Decision | Rationale |
|---|---|
| Vercel for frontend only | Free tier, auto-deploy from GitHub, SPA routing via vercel.json |
| Render for backend only | Free tier Docker hosting, managed PostgreSQL, auto-deploy |
| `VITE_API_URL` for API calls | Allows frontend to point at any backend without code changes |
| Bearer tokens (not cookies) for auth | Works reliably cross-origin; cookies only for refresh token |
| `SameSite=none` cookies | Required for cross-domain refresh token flow |
| Migrations on boot | Idempotent SQL files, no manual DDL, tracked in schema_migrations |
| Product images in `public/` | Served by Vercel CDN, no backend needed for static assets |

---

## 12. Known limitations (free tier)

- Render web services sleep after ~15 min idle (cold start ~10-30s on next request)
- Render PostgreSQL expires after 30 days (upgrade to paid for persistence)
- No Redis on free tier (cache is best-effort, queues disabled)
- No background worker (email/analytics rollup disabled)
- Vercel: 100GB bandwidth/month, 1000 build minutes/month

---

## 13. Recent fixes (August 2026)

| Commit | Fix |
|---|---|
| `efebaef` | Blog post image paths: meat-quality.jpg → dough.jpg, hawawshi.jpg → feteer.jpg |
| `d0b068f` | Product image backfill: array_length returns NULL for empty arrays |
| `5a78f19` | Gallery seed data, offer-product links, product images, cross-origin auth |
| `2ea5c08` | Vercel build: keep server/ for workspace resolution |

### Issues fixed
1. **Admin Login**: SameSite=Lax cookies blocked cross-origin refresh → set SameSite=none
2. **Offers**: offer_products table empty due to slug mismatches → migration backfilled
3. **Gallery**: galleryImagesSeed was empty array → populated with 20 product images
4. **Product Images**: 8 products had empty images[] → migration backfilled from public/
5. **Blog Images**: Posts referenced non-existent files → updated to actual files

---

*Last updated: August 22, 2026*
