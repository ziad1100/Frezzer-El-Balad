/**
 * E2E test: Admin-only product actions on the live production site.
 *
 * Verifies:
 *   1. Admin sees custom weight + إتمام الطلب on product pages
 *   2. Client does NOT see those admin controls
 *   3. Works for multiple products from different categories
 *
 * Run:
 *   E2E_BASE_URL=https://frezzer-el-balad.vercel.app npx playwright test e2e/admin-product-actions.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';

const BASE = 'https://frezzer-el-balad.vercel.app';
const ADMIN_EMAIL = 'admin@frezzerelbalad.com';
const ADMIN_PASSWORD = 'frezzerbalad@007';
const CUSTOMER_EMAIL = 'customer@frezzerelbalad.dev';
const CUSTOMER_PASSWORD = 'Frezzer123!';

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

async function getProductLinks(page: Page): Promise<string[]> {
  await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Collect product links — they use /product/{slug}
  const links = await page.locator('a[href*="/product/"]').evaluateAll((els) =>
    [...new Set(els.map((el) => (el as HTMLAnchorElement).href))].filter((h) => h.includes('/product/')),
  );
  return links.slice(0, 5); // Test first 5 products
}

test.describe('Admin product actions', () => {
  test('admin sees custom weight + checkout button on product pages', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const productLinks = await getProductLinks(page);
    console.log(`Found ${productLinks.length} product links to test`);

    for (const link of productLinks) {
      console.log(`Testing: ${link}`);
      await page.goto(link, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verify custom weight button exists
      const customWeightBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
      await expect(customWeightBtn).toBeVisible({ timeout: 5000 });
      console.log('  ✓ Custom Weight button visible');

      // Click custom weight and verify input appears
      await customWeightBtn.click();
      await page.waitForTimeout(500);
      const weightInput = page.locator('input[type="number"]').filter({ hasText: '' }).last();
      await expect(weightInput).toBeVisible({ timeout: 3000 });
      console.log('  ✓ Custom weight input visible');

      // Verify إتمام الطلب button exists
      const checkoutBtn = page.locator('button').filter({ hasText: /إتمام الطلب|Checkout Now/ });
      await expect(checkoutBtn).toBeVisible({ timeout: 3000 });
      console.log('  ✓ Checkout button visible');

      // Verify أضف إلى السلة button exists
      const addToCartBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ });
      await expect(addToCartBtn.first()).toBeVisible({ timeout: 3000 });
      console.log('  ✓ Add to Cart button visible');
    }
  });

  test('client does NOT see admin controls', async ({ page }) => {
    // Clear any previous auth state
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());

    const productLinks = await getProductLinks(page);
    console.log(`Found ${productLinks.length} product links to test as client`);

    for (const link of productLinks) {
      console.log(`Testing: ${link}`);
      await page.goto(link, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verify custom weight button does NOT exist
      const customWeightBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
      await expect(customWeightBtn).toHaveCount(0, { timeout: 3000 });
      console.log('  ✓ Custom Weight button NOT visible (correct)');

      // Verify checkout button does NOT exist
      const checkoutBtn = page.locator('button').filter({ hasText: /إتمام الطلب|Checkout Now/ });
      await expect(checkoutBtn).toHaveCount(0, { timeout: 3000 });
      console.log('  ✓ Checkout button NOT visible (correct)');

      // Verify add to cart DOES exist (normal client flow)
      const addToCartBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ });
      await expect(addToCartBtn.first()).toBeVisible({ timeout: 3000 });
      console.log('  ✓ Add to Cart button visible (normal client flow)');
    }
  });
});
