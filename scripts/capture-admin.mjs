import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const EMAIL = 'admin@frezzerelbalad.com';
const PASS = 'frezzerbalad@007';
const VIEWPORT = { width: 1440, height: 900 };

const ADMIN_PAGES = [
  { path: '/admin', name: 'admin-dashboard' },
  { path: '/admin/orders', name: 'admin-orders' },
  { path: '/admin/purchases', name: 'admin-purchases' },
  { path: '/admin/products', name: 'admin-products' },
  { path: '/admin/categories', name: 'admin-categories' },
  { path: '/admin/offers', name: 'admin-offers' },
  { path: '/admin/coupons', name: 'admin-coupons' },
  { path: '/admin/banners', name: 'admin-banners' },
  { path: '/admin/gallery', name: 'admin-gallery' },
  { path: '/admin/labels', name: 'admin-labels' },
  { path: '/admin/payments', name: 'admin-payments' },
  { path: '/admin/reviews', name: 'admin-reviews' },
  { path: '/admin/users', name: 'admin-users' },
  { path: '/admin/posts', name: 'admin-posts' },
  { path: '/admin/branches', name: 'admin-branches' },
  { path: '/admin/contacts', name: 'admin-contacts' },
  { path: '/admin/settings', name: 'admin-settings' },
  { path: '/admin/printer', name: 'admin-printer' },
  { path: '/admin/account', name: 'admin-account' },
];

mkdirSync('screenshots', { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  // ── Login ──
  console.log('Logging in...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin**', { timeout: 15000 });
  console.log('Logged in successfully.');

  // ── Capture each admin page ──
  for (const { path, name } of ADMIN_PAGES) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500); // allow lazy content to render
      const filePath = `screenshots/${name}.png`;
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✅ ${name} — captured`);
    } catch (err) {
      console.error(`❌ ${name} — ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone! All screenshots saved to screenshots/');
}

main().catch(console.error);
