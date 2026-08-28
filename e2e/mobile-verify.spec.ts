/**
 * Focused mobile verification: checks admin controls are present,
 * correctly laid out, and the page doesn't overflow horizontally.
 */
import { test, type Page } from '@playwright/test';

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

test.use({ viewport: { width: 390, height: 844 } });

test('mobile: admin controls on product page', async ({ page }) => {
  await loginAdmin(page);

  // Pick a product with sizes (steak)
  await page.goto(`${BASE}/product/steak-meat-fresh-meat-meat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Screenshot the full page to see everything
  await page.screenshot({ path: 'test-results/mobile-admin-full.png', fullPage: true });

  // Check page doesn't overflow
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const vpWidth = 390;
  console.log(`Body width: ${bodyWidth}, Viewport: ${vpWidth}`);
  console.log(`Horizontal overflow: ${bodyWidth <= vpWidth + 5 ? 'NONE ✓' : 'OVERFLOW ✗'}`);

  // Check all required elements are in the DOM
  const checks = [
    { name: 'Custom Weight button', selector: 'button:has-text("وزن مخصص"), button:has-text("Custom Weight")' },
    { name: 'Add to Cart button', selector: 'button:has-text("أضف إلى السلة"), button:has-text("Add to Cart")' },
    { name: 'Checkout button', selector: 'button:has-text("إتمام الطلب"), button:has-text("Checkout Now")' },
  ];

  for (const { name, selector } of checks) {
    const el = page.locator(selector).first();
    const count = await page.locator(selector).count();
    const text = count > 0 ? await el.textContent() : '(not found)';
    console.log(`${count > 0 ? '✓' : '✗'} ${name}: ${text?.trim().substring(0, 40)}`);
  }

  // Click custom weight and verify sub-elements appear
  const cwBtn = page.locator('button:has-text("وزن مخصص"), button:has-text("Custom Weight")').first();
  await cwBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await cwBtn.click();
  await page.waitForTimeout(500);

  // Take screenshot after opening custom weight
  await page.screenshot({ path: 'test-results/mobile-admin-customweight.png', fullPage: true });

  // Check custom weight sub-elements
  const inputCount = await page.locator('input[type="number"][step="0.1"]').count();
  const selectCount = await page.locator('select').count();
  console.log(`${inputCount > 0 ? '✓' : '✗'} Weight number input present (${inputCount})`);
  console.log(`${selectCount > 0 ? '✓' : '✗'} Unit selector present (${selectCount})`);

  // Enter a value and check price appears
  if (inputCount > 0) {
    await page.locator('input[type="number"][step="0.1"]').fill('750');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/mobile-admin-weight-entered.png', fullPage: true });

    // Check validation - try invalid value
    await page.locator('input[type="number"][step="0.1"]').fill('0');
    await page.waitForTimeout(300);
    const hasError = await page.locator('text=/أدخل وزناً صحيحاً|valid weight/').count() > 0;
    console.log(`${hasError ? '✓' : '✗'} Validation error shown for 0g`);
  }
});

test('mobile: client view has no admin controls', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());

  await page.goto(`${BASE}/product/steak-meat-fresh-meat-meat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'test-results/mobile-client-full.png', fullPage: true });

  const cwCount = await page.locator('button:has-text("وزن مخصص"), button:has-text("Custom Weight")').count();
  const coCount = await page.locator('button:has-text("إتمام الطلب"), button:has-text("Checkout Now")').count();
  const atcCount = await page.locator('button:has-text("أضف إلى السلة"), button:has-text("Add to Cart")').count();

  console.log(`Custom Weight: ${cwCount === 0 ? '✓ hidden' : '✗ visible (' + cwCount + ')'}`);
  console.log(`Checkout: ${coCount === 0 ? '✓ hidden' : '✗ visible (' + coCount + ')'}`);
  console.log(`Add to Cart: ${atcCount > 0 ? '✓ visible' : '✗ missing'}`);

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  console.log(`Horizontal overflow: ${bodyWidth <= 395 ? 'NONE ✓' : 'OVERFLOW ✗'} (body=${bodyWidth})`);
});
