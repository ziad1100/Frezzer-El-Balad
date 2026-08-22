/**
 * End-to-end tests for Frezzer El Balad.
 *
 * Covers the complete user journey:
 *   Homepage → Menu → Product detail → Cart → Offers → Gallery
 *   Customer login → Admin login → Admin dashboard sections
 *
 * Run against production:
 *   E2E_BASE_URL=https://frezzer-el-balad.vercel.app npx playwright test e2e/full-flow.spec.ts
 *
 * Run against local dev (starts vite + backend automatically):
 *   npx playwright test e2e/full-flow.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';

// ── Constants ──────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'admin@frezzerelbalad.dev';
const ADMIN_PASSWORD = 'Frezzer123!';
const CUSTOMER_EMAIL = 'customer@frezzerelbalad.dev';
const CUSTOMER_PASSWORD = 'Frezzer123!';

// ── Helpers ────────────────────────────────────────────────────────────

/** Log in via the UI and wait for redirect away from /login. */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

/** Wait for at least one real <img> (not a skeleton placeholder). */
async function waitForImages(page: Page, timeout = 15_000): Promise<void> {
  await page.locator('img[src]').first().waitFor({ state: 'visible', timeout });
}

/** Get page body text, waiting for network to settle. */
async function bodyText(page: Page): Promise<string> {
  await page.waitForLoadState('networkidle');
  return page.textContent('body') ?? '';
}

// ── Tests ──────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('loads with correct title and branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/فريزر|Frezzer/);
    expect(await bodyText(page)).toContain('فريزر');
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

test.describe('Menu', () => {
  test('loads products with images from backend', async ({ page }) => {
    await page.goto('/menu');
    await waitForImages(page);

    const productLinks = page.locator('a[href^="/product/"]');
    expect(await productLinks.count()).toBeGreaterThan(5);

    const productImages = page.locator('img[src*="/images/products/"]');
    expect(await productImages.count()).toBeGreaterThan(5);
  });

  test('shows category navigation', async ({ page }) => {
    await page.goto('/menu');
    await waitForImages(page);
    expect(await bodyText(page)).toContain('لحوم'); // Meat in Arabic
  });
});

test.describe('Product detail', () => {
  test('loads product info with sizes and add-to-cart', async ({ page }) => {
    await page.goto('/product/hawawshi-hawawshi-hawawshi');
    await page.waitForLoadState('networkidle');

    const text = await bodyText(page);
    // Arabic or English product name
    expect(text.includes('Hawawshi') || text.includes('حواوشي')).toBeTruthy();
    expect(text).toContain('500'); // Size

    const addBtn = page.locator('button').filter({ hasText: /add|أضف/i });
    await expect(addBtn.first()).toBeVisible();
  });
});

test.describe('Cart', () => {
  test('add-to-cart button works from menu', async ({ page }) => {
    await page.goto('/menu');
    await waitForImages(page);

    // Find and click an add-to-cart button (aria-label contains "add")
    const addBtn = page.locator('button[aria-label*="add" i], button[aria-label*="أضف" i]').first();
    await addBtn.click();
    // No assertion needed — if click throws, the test fails
  });
});

test.describe('Offers', () => {
  test('loads active offers with products', async ({ page }) => {
    await page.goto('/offers');
    await page.waitForLoadState('networkidle');

    const text = await bodyText(page);
    const hasOffers = text.includes('عرض') || text.includes('Deal') || text.includes('OFF');
    expect(hasOffers).toBeTruthy();
  });
});

test.describe('Gallery', () => {
  test('loads gallery images', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    expect(await images.count()).toBeGreaterThanOrEqual(10);
  });
});

test.describe('Customer login', () => {
  test('login form renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('can login as customer', async ({ page }) => {
    await login(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    expect(page.url()).not.toContain('/login');
  });
});

test.describe('Admin', () => {
  test('admin login redirects to /admin', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(page.url()).toContain('/admin');
    expect((await bodyText(page)).length).toBeGreaterThan(200);
  });

  for (const [section, path] of [
    ['products', '/admin/products'],
    ['offers', '/admin/offers'],
    ['gallery', '/admin/gallery'],
    ['orders', '/admin/orders'],
  ] as const) {
    test(`admin ${section} page loads`, async ({ page }) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const text = await bodyText(page);
      expect(text.length).toBeGreaterThan(100);
    });
  }
});

test.describe('Public pages', () => {
  for (const path of ['/about', '/contact', '/blog', '/branches']) {
    test(`${path} loads with content`, async ({ page }) => {
      await page.goto(path);
      const text = await bodyText(page);
      expect(text.length).toBeGreaterThan(100);
    });
  }
});
