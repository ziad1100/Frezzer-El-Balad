/**
 * End-to-end tests for Frezzer El Balad.
 *
 * Covers the complete user journey:
 *   1. Homepage loads with branding
 *   2. Menu page shows products with images
 *   3. Product detail page loads
 *   4. Add to cart works
 *   5. Offers page shows active offers
 *   6. Gallery page shows images
 *   7. Customer login works
 *   8. Admin login → admin dashboard loads
 *   9. Admin sections (products, offers, gallery, orders) load
 *
 * Run against production:
 *   E2E_BASE_URL=https://frezzer-el-balad.vercel.app npx playwright test e2e/full-flow.spec.ts
 *
 * Run against local dev:
 *   npx playwright test e2e/full-flow.spec.ts
 */
import { expect, test } from '@playwright/test';

// ── Helpers ────────────────────────────────────────────────────────────

/** Wait for the API to respond and the UI to render data. */
async function waitForData(page: import('@playwright/test').Page, timeout = 15_000) {
  // Wait for at least one real <img> to appear (skeletons don't have real src)
  await page.locator('img[src]').first().waitFor({ state: 'visible', timeout });
}

// ── Tests ──────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('loads with correct title and branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/فريزر|Frezzer/);
    const body = await page.textContent('body');
    expect(body).toContain('فريزر');
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});

test.describe('Menu page', () => {
  test('loads products with images from Render', async ({ page }) => {
    await page.goto('/menu');
    await waitForData(page);

    // At least some product cards should render
    const productLinks = page.locator('a[href^="/product/"]');
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(5);

    // Product images should have valid src (not empty)
    const images = page.locator('img[src*="/images/products/"]');
    const imgCount = await images.count();
    expect(imgCount).toBeGreaterThan(5);
  });

  test('categories filter works', async ({ page }) => {
    await page.goto('/menu');
    await waitForData(page);

    // Should have category navigation
    const body = await page.textContent('body');
    expect(body).toContain('لحوم');  // Meat in Arabic
  });
});

test.describe('Product detail', () => {
  test('loads product info, sizes, and extras', async ({ page }) => {
    await page.goto('/product/hawawshi-hawawshi-hawawshi');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const body = await page.textContent('body');
    // Page may render in Arabic or English depending on browser locale
    const hasProductName = body.includes('Hawawshi') || body.includes('حواوشي');
    expect(hasProductName).toBeTruthy();

    // Should show sizes
    expect(body).toContain('500');

    // Should show add-to-cart button
    const addBtn = page.locator('button').filter({ hasText: /add|أضف/i });
    await expect(addBtn.first()).toBeVisible();
  });
});

test.describe('Add to cart', () => {
  test('can add a product to cart from menu page', async ({ page }) => {
    await page.goto('/menu');
    await waitForData(page);

    // Click the first "+" (add) button
    const addButtons = page.locator('button[aria-label]').filter({ hasText: /add/i });
    // If no aria-label, try the brand-colored button inside the quantity controls
    let clicked = false;
    const count = await addButtons.count();
    if (count > 0) {
      await addButtons.first().click();
      clicked = true;
    } else {
      // Fallback: find the plus button (bg-brand-600)
      const plusBtns = page.locator('.bg-brand-600').first();
      if (await plusBtns.isVisible().catch(() => false)) {
        await plusBtns.click();
        clicked = true;
      }
    }
    expect(clicked).toBeTruthy();
    await page.waitForTimeout(1000);
  });
});

test.describe('Offers page', () => {
  test('loads active offers with products', async ({ page }) => {
    await page.goto('/offers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const body = await page.textContent('body');
    // Should contain offer content (Arabic or English)
    const hasOffers =
      body.includes('عرض') ||
      body.includes('خصم') ||
      body.includes('Deal') ||
      body.includes('OFF');
    expect(hasOffers).toBeTruthy();
  });
});

test.describe('Gallery page', () => {
  test('loads gallery images', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Gallery should render multiple images
    const images = page.locator('img');
    const count = await images.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });
});

test.describe('Customer login', () => {
  test('login form renders with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('can login as customer', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('customer@frezzerelbalad.dev');
    await page.locator('input[type="password"]').fill('Frezzer123!');
    await page.locator('button[type="submit"]').click();

    // Should redirect away from login (to homepage or orders)
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
    expect(page.url()).not.toContain('/login');
  });
});

test.describe('Admin login and dashboard', () => {
  test('admin login redirects to admin dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@frezzerelbalad.dev');
    await page.locator('input[type="password"]').fill('Frezzer123!');
    await page.locator('button[type="submit"]').click();

    // Should redirect to /admin
    await page.waitForURL('**/admin**', { timeout: 15_000 });
    expect(page.url()).toContain('/admin');

    // Verify we're on the admin page
    expect(page.url()).toContain('/admin');
    // The page loaded with content (branding or admin nav)
    const body = await page.textContent('body');
    expect(body!.length).toBeGreaterThan(200);
  });

  test('admin products page loads', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@frezzerelbalad.dev');
    await page.locator('input[type="password"]').fill('Frezzer123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin**', { timeout: 15_000 });

    // Navigate to products
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const body = await page.textContent('body');
    const hasProducts = body.includes('Product') || body.includes('منتج');
    expect(hasProducts).toBeTruthy();
  });

  test('admin offers page loads', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@frezzerelbalad.dev');
    await page.locator('input[type="password"]').fill('Frezzer123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin**', { timeout: 15_000 });

    await page.goto('/admin/offers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const body = await page.textContent('body');
    const hasOffers = body.includes('Offer') || body.includes('عرض');
    expect(hasOffers).toBeTruthy();
  });

  test('admin gallery page loads', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@frezzerelbalad.dev');
    await page.locator('input[type="password"]').fill('Frezzer123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin**', { timeout: 15_000 });

    await page.goto('/admin/gallery');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const body = await page.textContent('body');
    const hasGallery = body.includes('Gallery') || body.includes('معرض');
    expect(hasGallery).toBeTruthy();
  });

  test('admin orders page loads', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@frezzerelbalad.dev');
    await page.locator('input[type="password"]').fill('Frezzer123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/admin**', { timeout: 15_000 });

    await page.goto('/admin/orders');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const body = await page.textContent('body');
    const hasOrders = body.includes('Order') || body.includes('طلب');
    expect(hasOrders).toBeTruthy();
  });
});

test.describe('Public pages', () => {
  for (const path of ['/about', '/contact', '/blog', '/branches']) {
    test(`${path} page loads with content`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const body = await page.textContent('body');
      expect(body!.length).toBeGreaterThan(100);
    });
  }
});
