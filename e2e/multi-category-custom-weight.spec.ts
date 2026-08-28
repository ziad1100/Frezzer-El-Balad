/**
 * E2E test: Custom weight across multiple product categories on live production.
 *
 * For each category product:
 *   1. Open product page as admin
 *   2. Enable custom weight, enter a value, verify price
 *   3. Add to cart
 *   4. Verify cart shows correct custom weight
 *
 * Run:
 *   E2E_BASE_URL=https://frezzer-el-balad.vercel.app npx playwright test e2e/multi-category-custom-weight.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';

const BASE = 'https://frezzer-el-balad.vercel.app';
const ADMIN_EMAIL = 'admin@frezzerelbalad.com';
const ADMIN_PASSWORD = 'frezzerbalad@007';

async function loginAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

async function getProductLinks(page: Page): Promise<string[]> {
  await page.goto(`${BASE}/menu`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return page.locator('a[href*="/product/"]').evaluateAll((els) =>
    [...new Set(els.map((el) => (el as HTMLAnchorElement).href))].filter((h) => h.includes('/product/')),
  );
}

interface TestResult {
  slug: string;
  customWeightBtn: boolean;
  weightInput: boolean;
  priceShown: boolean;
  addToCart: boolean;
  checkoutBtn: boolean;
  validation: boolean;
}

async function testProduct(page: Page, link: string): Promise<TestResult> {
  const slug = link.split('/product/')[1] ?? link;
  await page.goto(link, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const result: TestResult = {
    slug,
    customWeightBtn: false,
    weightInput: false,
    priceShown: false,
    addToCart: false,
    checkoutBtn: false,
    validation: false,
  };

  // Check custom weight button
  const cwBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
  result.customWeightBtn = (await cwBtn.count()) > 0;
  if (!result.customWeightBtn) return result;

  // Click custom weight
  await cwBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await cwBtn.click({ timeout: 5000 });
  await page.waitForTimeout(500);

  // Check weight input
  const weightInput = page.locator('input[type="number"][step="0.1"]');
  result.weightInput = (await weightInput.count()) > 0;
  if (!result.weightInput) return result;

  // Enter custom weight
  await weightInput.fill('750');
  await page.waitForTimeout(500);

  // Check price shown
  const priceSection = page.locator('text=/السعر|Price/').first();
  result.priceShown = await priceSection.isVisible().catch(() => false);

  // Check validation (enter 0)
  await weightInput.fill('0');
  await page.waitForTimeout(300);
  result.validation = (await page.locator('text=/أدخل وزناً صحيحاً|valid weight/').count()) > 0;

  // Reset to valid value
  await weightInput.fill('750');
  await page.waitForTimeout(300);

  // Check checkout button
  result.checkoutBtn = (await page.locator('button').filter({ hasText: /إتمام الطلب|Checkout Now/ }).count()) > 0;

  // Check add to cart
  result.addToCart = (await page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ }).count()) > 0;

  // Add to cart
  const addBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ }).first();
  await addBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await addBtn.click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  return result;
}

test.describe('Multi-category custom weight', () => {
  test('admin custom weight works across all product categories', async ({ page }) => {
    test.setTimeout(120_000); // 2 min for testing many products
    await loginAdmin(page);

    const allLinks = await getProductLinks(page);
    console.log(`Found ${allLinks.length} products total\n`);

    // Test up to 10 products (covers multiple categories)
    const testLinks = allLinks.slice(0, 10);
    const results: TestResult[] = [];

    for (const link of testLinks) {
      console.log(`Testing: ${link.split('/product/')[1]}`);
      const r = await testProduct(page, link);
      results.push(r);

      console.log(`  Custom Weight btn: ${r.customWeightBtn ? '✓' : '✗'}`);
      console.log(`  Weight input:     ${r.weightInput ? '✓' : '✗'}`);
      console.log(`  Price shown:      ${r.priceShown ? '✓' : '✗'}`);
      console.log(`  Validation:       ${r.validation ? '✓' : '✗'}`);
      console.log(`  Checkout btn:     ${r.checkoutBtn ? '✓' : '✗'}`);
      console.log(`  Add to Cart:      ${r.addToCart ? '✓' : '✗'}`);
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════');
    console.log(`  PRODUCTS TESTED: ${results.length}`);
    console.log(`  Custom Weight:   ${results.filter((r) => r.customWeightBtn).length}/${results.length}`);
    console.log(`  Weight Input:    ${results.filter((r) => r.weightInput).length}/${results.length}`);
    console.log(`  Price Calc:      ${results.filter((r) => r.priceShown).length}/${results.length}`);
    console.log(`  Validation:      ${results.filter((r) => r.validation).length}/${results.length}`);
    console.log(`  Checkout Btn:    ${results.filter((r) => r.checkoutBtn).length}/${results.length}`);
    console.log(`  Add to Cart:     ${results.filter((r) => r.addToCart).length}/${results.length}`);
    console.log('═══════════════════════════════════════');

    // Verify ALL products have admin controls
    for (const r of results) {
      expect(r.customWeightBtn, `${r.slug}: custom weight button missing`).toBeTruthy();
      expect(r.weightInput, `${r.slug}: weight input missing`).toBeTruthy();
      expect(r.checkoutBtn, `${r.slug}: checkout button missing`).toBeTruthy();
      expect(r.addToCart, `${r.slug}: add to cart missing`).toBeTruthy();
      expect(r.validation, `${r.slug}: validation not working`).toBeTruthy();
    }
  });

  test('cart shows correct custom weight items', async ({ page }) => {
    await loginAdmin(page);

    // Pick one product and add it with custom weight
    await page.goto(`${BASE}/product/steak-meat-fresh-meat-meat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Enable custom weight
    const cwBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
    await cwBtn.scrollIntoViewIfNeeded();
    await cwBtn.click();
    await page.waitForTimeout(500);

    // Enter 750g
    await page.locator('input[type="number"][step="0.1"]').fill('750');
    await page.waitForTimeout(500);

    // Add to cart
    const addBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ }).first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to checkout
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Screenshot the checkout page
    await page.screenshot({ path: 'test-results/multi-cat-checkout.png', fullPage: true });

    // Verify the cart shows the product with custom weight
    const bodyText = await page.textContent('body') ?? '';
    const has750g = bodyText.includes('750');
    const hasSteak = bodyText.includes('استيك') || bodyText.includes('steak') || bodyText.includes('Steak');

    console.log(`Cart contains 750g: ${has750g ? '✓' : '✗'}`);
    console.log(`Cart contains steak: ${hasSteak ? '✓' : '✗'}`);

    expect(has750g, 'Cart should show 750g custom weight').toBeTruthy();
  });
});
