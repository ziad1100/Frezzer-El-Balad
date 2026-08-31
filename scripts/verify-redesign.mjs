import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const SCREENSHOTS = 'screenshots';

async function main() {
  mkdirSync(SCREENSHOTS, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // ── ADMIN (authenticated) ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'admin@frezzerelbalad.com');
  await page.fill('input[type="password"]', 'frezzerbalad@007');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  console.log('✅ Logged in as admin, URL:', page.url());

  const results = [];

  // ── Admin Pages ──
  const adminPages = [
    { url: '/admin', name: 'admin-dashboard' },
    { url: '/admin/orders', name: 'admin-orders' },
    { url: '/admin/purchases', name: 'admin-purchases' },
    { url: '/admin/products', name: 'admin-products' },
    { url: '/admin/categories', name: 'admin-categories' },
    { url: '/admin/coupons', name: 'admin-coupons' },
    { url: '/admin/banners', name: 'admin-banners' },
    { url: '/admin/settings', name: 'admin-settings' },
  ];

  for (const p of adminPages) {
    try {
      await page.goto(`http://localhost:5173${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SCREENSHOTS}/${p.name}.png`, fullPage: false });

      const finalUrl = page.url().replace('http://localhost:5173', '');
      const heading = await page.locator('h1, h2').first().textContent().catch(() => 'none');
      const tableCount = await page.locator('table').count();
      const isOnPage = finalUrl.startsWith(p.url);

      results.push({ name: p.name, url: finalUrl, heading: heading?.trim().slice(0, 50), table: tableCount > 0, onPage: isOnPage });
      console.log(`  ✅ ${p.name}: heading="${heading?.trim().slice(0, 40)}" table=${tableCount > 0} onPage=${isOnPage}`);
    } catch (e) {
      results.push({ name: p.name, error: e.message.slice(0, 80) });
      console.log(`  ❌ ${p.name}: ${e.message.slice(0, 80)}`);
    }
  }

  // ── Admin Tablet ──
  const tctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tpage = await tctx.newPage();
  await tpage.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
  await tpage.waitForTimeout(1000);
  await tpage.fill('input[type="email"]', 'admin@frezzerelbalad.com');
  await tpage.fill('input[type="password"]', 'frezzerbalad@007');
  await tpage.click('button[type="submit"]');
  await tpage.waitForTimeout(3000);
  await tpage.goto('http://localhost:5173/admin', { waitUntil: 'networkidle', timeout: 15000 });
  await tpage.waitForTimeout(2000);
  await tpage.screenshot({ path: `${SCREENSHOTS}/admin-dashboard-tablet.png`, fullPage: false });
  console.log('  ✅ admin-dashboard-tablet');

  // ── Client Pages (Desktop) ──
  const clientPages = [
    { url: '/', name: 'client-home-desktop' },
    { url: '/menu', name: 'client-menu-desktop' },
    { url: '/login', name: 'client-login-desktop' },
    { url: '/register', name: 'client-register-desktop' },
  ];

  for (const p of clientPages) {
    try {
      await page.goto(`http://localhost:5173${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS}/${p.name}.png`, fullPage: false });

      const heading = await page.locator('h1, h2').first().textContent().catch(() => 'none');
      results.push({ name: p.name, heading: heading?.trim().slice(0, 50) });
      console.log(`  ✅ ${p.name}: heading="${heading?.trim().slice(0, 40)}"`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message.slice(0, 80)}`);
    }
  }

  // ── Client Mobile ──
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mpage = await mctx.newPage();
  for (const p of [
    { url: '/', name: 'client-home-mobile' },
    { url: '/menu', name: 'client-menu-mobile' },
    { url: '/login', name: 'client-login-mobile' },
  ]) {
    try {
      await mpage.goto(`http://localhost:5173${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await mpage.waitForTimeout(2000);
      await mpage.screenshot({ path: `${SCREENSHOTS}/${p.name}.png`, fullPage: false });
      console.log(`  ✅ ${p.name}`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message.slice(0, 80)}`);
    }
  }

  // ── Client Tablet ──
  const tabCtx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabPage = await tabCtx.newPage();
  for (const p of [
    { url: '/', name: 'client-home-tablet' },
    { url: '/menu', name: 'client-menu-tablet' },
  ]) {
    try {
      await tabPage.goto(`http://localhost:5173${p.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await tabPage.waitForTimeout(2000);
      await tabPage.screenshot({ path: `${SCREENSHOTS}/${p.name}.png`, fullPage: false });
      console.log(`  ✅ ${p.name}`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message.slice(0, 80)}`);
    }
  }

  // ── Full Page ──
  const fpCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const fpPage = await fpCtx.newPage();
  await fpPage.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
  await fpPage.waitForTimeout(2000);
  await fpPage.screenshot({ path: `${SCREENSHOTS}/client-home-fullpage.png`, fullPage: true });
  console.log('  ✅ client-home-fullpage');

  // Write results
  writeFileSync(`${SCREENSHOTS}/results.json`, JSON.stringify(results, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════');
  const ok = results.filter(r => !r.error).length;
  const fail = results.filter(r => r.error).length;
  console.log(`✅ Passed: ${ok}  ❌ Failed: ${fail}`);
  console.log('═══════════════════════════════════════');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
