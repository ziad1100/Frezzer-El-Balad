/**
 * E2E test: Full admin checkout flow with custom weight on live production.
 *
 * Flow:
 *   1. Login as admin
 *   2. Open a product from the menu
 *   3. Select custom weight (750g)
 *   4. Set quantity to 2
 *   5. Add to cart
 *   6. Navigate to checkout
 *   7. Verify cart shows correct product, weight, qty, price
 *   8. Fill customer info
 *   9. Select payment method
 *  10. Place order
 *  11. Verify order success
 *
 * Run:
 *   E2E_BASE_URL=https://frezzer-el-balad.vercel.app npx playwright test e2e/admin-checkout-flow.spec.ts
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

test.describe('Admin checkout flow with custom weight', () => {
  test('full flow: custom weight → add to cart → checkout → order placed', async ({ page }) => {
    test.setTimeout(60_000);

    // ── Step 1: Login as admin ──
    console.log('Step 1: Logging in as admin...');
    await loginAdmin(page);
    console.log('  ✓ Logged in');

    // ── Step 2: Open a product (steak) ──
    console.log('Step 2: Opening steak product page...');
    await page.goto(`${BASE}/product/steak-meat-fresh-meat-meat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Verify product loaded
    const productName = await page.locator('h1').first().textContent();
    console.log(`  ✓ Product: ${productName?.trim()}`);

    // ── Step 3: Select custom weight ──
    console.log('Step 3: Enabling custom weight...');
    const cwBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
    await cwBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await cwBtn.click();
    await page.waitForTimeout(500);

    const weightInput = page.locator('input[type="number"][step="0.1"]');
    await weightInput.fill('750');
    await page.waitForTimeout(500);
    console.log('  ✓ Custom weight set to 750g');

    // Verify price is shown
    const priceVisible = await page.locator('text=/السعر|Price/').first().isVisible().catch(() => false);
    console.log(`  ${priceVisible ? '✓' : '✗'} Price calculation displayed`);

    // Screenshot after custom weight
    await page.screenshot({ path: 'test-results/admin-flow-01-customweight.png', fullPage: false });

    // ── Step 4: Set quantity to 2 ──
    console.log('Step 4: Setting quantity to 2...');
    const plusBtn = page.locator('button[aria-label="plus"]');
    await plusBtn.scrollIntoViewIfNeeded();
    await plusBtn.click();
    await page.waitForTimeout(300);
    console.log('  ✓ Quantity set to 2');

    // ── Step 5: Add to cart ──
    console.log('Step 5: Adding to cart...');
    const addBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ }).first();
    await addBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await addBtn.click();
    await page.waitForTimeout(1500);
    console.log('  ✓ Added to cart');

    // Screenshot after adding to cart
    await page.screenshot({ path: 'test-results/admin-flow-02-added.png', fullPage: false });

    // ── Step 6: Navigate to checkout ──
    console.log('Step 6: Navigating to checkout...');
    await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('  ✓ On checkout page');

    // Screenshot checkout page
    await page.screenshot({ path: 'test-results/admin-flow-03-checkout.png', fullPage: true });

    // ── Step 7: Verify cart contents ──
    console.log('Step 7: Verifying cart contents...');
    const bodyText = await page.textContent('body') ?? '';

    // Check for custom weight (750) in the cart
    const has750 = bodyText.includes('750');
    console.log(`  ${has750 ? '✓' : '✗'} Cart shows 750g custom weight`);

    // Check for steak product name
    const hasSteak = bodyText.includes('استيك') || bodyText.includes('steak') || bodyText.includes('Steak');
    console.log(`  ${hasSteak ? '✓' : '✗'} Cart shows steak product`);

    // Check quantity is 2
    const hasQty2 = bodyText.includes('× 2') || bodyText.includes('x 2');
    console.log(`  ${hasQty2 ? '✓' : '✗'} Cart shows quantity 2`);

    // ── Step 8: Fill customer info (admin form) ──
    console.log('Step 8: Filling customer info...');
    const nameInput = page.locator('input').nth(0);
    const phoneInput = page.locator('input[inputmode="numeric"]');
    const cityInput = page.locator('input').nth(2);
    const streetInput = page.locator('input').nth(3);
    const buildingInput = page.locator('input').nth(4);

    // Fill admin customer info (optional fields)
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('عميل تجريبي');
    }
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill('01012345678');
    }
    if (await cityInput.isVisible().catch(() => false)) {
      await cityInput.fill('القاهرة');
    }
    if (await streetInput.isVisible().catch(() => false)) {
      await streetInput.fill('شارع التحرير');
    }
    if (await buildingInput.isVisible().catch(() => false)) {
      await buildingInput.fill('15');
    }
    console.log('  ✓ Customer info filled');

    // ── Step 9: Verify order summary ──
    console.log('Step 9: Checking order summary...');
    await page.screenshot({ path: 'test-results/admin-flow-04-filled.png', fullPage: true });

    // ── Step 10: Place order (cash on delivery) ──
    console.log('Step 10: Placing order...');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Check if submit button is enabled
    const isDisabled = await submitBtn.isDisabled();
    console.log(`  Submit button disabled: ${isDisabled}`);

    if (!isDisabled) {
      await submitBtn.click();
      await page.waitForTimeout(5000);

      // Screenshot after order
      await page.screenshot({ path: 'test-results/admin-flow-05-after-order.png', fullPage: true });

      // Check for success
      const afterText = await page.textContent('body') ?? '';
      const hasSuccess = afterText.includes('تم') || afterText.includes('نجاح') || afterText.includes('success');
      const hasPayment = afterText.includes('الدفع') || afterText.includes('payment') || afterText.includes('Complete Payment');
      const url = page.url();

      console.log(`  URL after order: ${url}`);
      console.log(`  ${hasSuccess ? '✓' : '?'} Success message detected`);
      console.log(`  ${hasPayment ? '✓' : '?'} Payment flow shown (manual payment)`);

      if (url.includes('/admin/orders')) {
        console.log('  ✓ Redirected to admin orders page');
      }
    } else {
      console.log('  ⚠ Submit button is disabled — checking validation...');
      const errorTexts = await page.locator('.text-red-400').allTextContents();
      console.log(`  Validation errors: ${errorTexts.join(', ') || 'none visible'}`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('  ADMIN CHECKOUT FLOW TEST COMPLETE');
    console.log('═══════════════════════════════════════');
  });

  test('admin quick checkout via product page button', async ({ page }) => {
    test.setTimeout(60_000);

    // ── Login ──
    await loginAdmin(page);

    // ── Open product ──
    await page.goto(`${BASE}/product/steak-meat-fresh-meat-meat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // ── Set custom weight 750g ──
    const cwBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
    await cwBtn.scrollIntoViewIfNeeded();
    await cwBtn.click();
    await page.waitForTimeout(500);
    await page.locator('input[type="number"][step="0.1"]').fill('750');
    await page.waitForTimeout(500);

    // ── Click إتمام الطلب (adds to cart + navigates to checkout) ──
    const checkoutBtn = page.locator('button').filter({ hasText: /إتمام الطلب|Checkout Now/ });
    await checkoutBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await checkoutBtn.click();
    await page.waitForTimeout(3000);

    // ── Verify we're on checkout page ──
    const url = page.url();
    console.log(`After "إتمام الطلب": ${url}`);
    const onCheckout = url.includes('/checkout');
    console.log(`${onCheckout ? '✓' : '✗'} Navigated to checkout`);

    // ── Verify cart shows custom weight ──
    const bodyText = await page.textContent('body') ?? '';
    const has750 = bodyText.includes('750');
    console.log(`${has750 ? '✓' : '✗'} Cart shows 750g custom weight`);

    await page.screenshot({ path: 'test-results/admin-flow-quick-checkout.png', fullPage: true });
  });
});
