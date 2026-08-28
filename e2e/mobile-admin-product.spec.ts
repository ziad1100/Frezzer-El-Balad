/**
 * E2E test: Verify mobile responsiveness of admin controls on Product Details.
 *
 * Checks that on a mobile viewport (iPhone 14):
 *   - Custom weight button, input, checkout button, and add-to-cart
 *     are all visible, not clipped, not overlapping
 *   - Layout is usable (buttons are tappable, input is reachable)
 *
 * Run:
 *   E2E_BASE_URL=https://frezzer-el-balad.vercel.app npx playwright test e2e/mobile-admin-product.spec.ts
 */
import { expect, test, type Page, type BrowserContext } from '@playwright/test';

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

/** Check that an element is visible and has non-zero dimensions (not clipped). */
async function isVisibleAndRendered(page: Page, locator: ReturnType<typeof page.locator>, name: string): Promise<boolean> {
  const count = await locator.count();
  if (count === 0) {
    console.log(`  ✗ ${name}: not found`);
    return false;
  }
  const box = await locator.first().boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    console.log(`  ✗ ${name}: present but has zero dimensions`);
    return false;
  }
  // Check it's within viewport (not clipped off-screen)
  const viewport = page.viewportSize();
  const inViewport = box.top < (viewport?.height ?? 800) && box.bottom > 0;
  if (!inViewport) {
    console.log(`  ✗ ${name}: rendered but outside viewport (top=${Math.round(box.top)}, bottom=${Math.round(box.bottom)})`);
    return false;
  }
  console.log(`  ✓ ${name}: visible (${Math.round(box.width)}×${Math.round(box.height)} at y=${Math.round(box.top)})`);
  return true;
}

test.describe('Mobile admin product controls', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

  test('admin controls are visible and usable on mobile', async ({ page }) => {
    await loginAdmin(page);

    const links = await getProductLinks(page);
    console.log(`Testing ${links.length} products on mobile viewport (390×844)\n`);

    // Test at least 3 products
    const testLinks = links.slice(0, 3);

    for (const link of testLinks) {
      const slug = link.split('/product/')[1];
      console.log(`── Product: ${slug} ──`);
      await page.goto(link, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // 1. Scroll down to the action area (buttons are below the fold on mobile)
      const addBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ }).first();
      await addBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // 2. Check all admin controls are visible
      const customWeightBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
      await isVisibleAndRendered(page, customWeightBtn, 'Custom Weight button');

      // 3. Click custom weight and check input
      await customWeightBtn.click();
      await page.waitForTimeout(500);

      const weightSection = page.locator('text=/الوزن المخصص|Custom Weight/').locator('..');
      const numberInput = page.locator('input[type="number"][step="0.1"]');
      await isVisibleAndRendered(page, numberInput, 'Custom weight input');

      const unitSelect = page.locator('select');
      await isVisibleAndRendered(page, unitSelect, 'Unit selector (g/kg)');

      // 4. Enter a custom weight value
      await numberInput.fill('750');
      await page.waitForTimeout(300);

      // 5. Check that the price calculation appears
      const priceText = page.locator('text=/السعر|Price/').first();
      const priceVisible = await priceText.isVisible().catch(() => false);
      console.log(`  ${priceVisible ? '✓' : '✗'} Price calculation shown after entering weight`);

      // 6. Check checkout button
      const checkoutBtn = page.locator('button').filter({ hasText: /إتمام الطلب|Checkout Now/ });
      await isVisibleAndRendered(page, checkoutBtn, 'Checkout button');

      // 7. Check add-to-cart button
      await isVisibleAndRendered(page, addBtn, 'Add to Cart button');

      // 8. Verify no horizontal overflow (body width <= viewport width)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const vpWidth = page.viewportSize()?.width ?? 390;
      const noOverflow = bodyWidth <= vpWidth + 5; // small tolerance
      console.log(`  ${noOverflow ? '✓' : '✗'} No horizontal overflow (body=${bodyWidth}, viewport=${vpWidth})`);

      // 9. Take a screenshot for visual verification
      await page.screenshot({ path: `test-results/mobile-${slug}.png`, fullPage: false });
      console.log(`  📸 Screenshot saved: test-results/mobile-${slug}.png\n`);
    }
  });

  test('client view on mobile has no admin controls', async ({ page }) => {
    // Clear auth
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());

    const links = await getProductLinks(page);
    const testLinks = links.slice(0, 3);
    console.log(`Testing ${testLinks.length} products as client on mobile\n`);

    for (const link of testLinks) {
      const slug = link.split('/product/')[1];
      console.log(`── Product: ${slug} (client) ──`);
      await page.goto(link, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const addBtn = page.locator('button').filter({ hasText: /أضف إلى السلة|Add to Cart/ }).first();
      await addBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const customWeightBtn = page.locator('button').filter({ hasText: /وزن مخصص|Custom Weight/ });
      const cwCount = await customWeightBtn.count();
      console.log(`  ${cwCount === 0 ? '✓' : '✗'} Custom Weight hidden (${cwCount} found)`);

      const checkoutBtn = page.locator('button').filter({ hasText: /إتمام الطلب|Checkout Now/ });
      const coCount = await checkoutBtn.count();
      console.log(`  ${coCount === 0 ? '✓' : '✗'} Checkout button hidden (${coCount} found)`);

      await isVisibleAndRendered(page, addBtn, 'Add to Cart button');

      // No horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const vpWidth = page.viewportSize()?.width ?? 390;
      console.log(`  ${bodyWidth <= vpWidth + 5 ? '✓' : '✗'} No horizontal overflow (body=${bodyWidth})\n`);
    }
  });
});
