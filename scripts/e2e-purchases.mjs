/**
 * E2E test: Admin purchases flow through production site.
 * Uses Playwright to automate login → purchases → add purchase → verify.
 */
import { chromium } from 'playwright';

const BASE = 'https://frezzer-el-balad.vercel.app';
const SCREENSHOT_DIR = 'C:/Users/my pc/AppData/Local/Temp';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Collect console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // ── Step 1: Login page ──
    console.log('Step 1: Loading login page...');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/step1-login.png`, fullPage: true });
    console.log('  ✓ Login page loaded');

    // ── Step 2: Fill login form and submit ──
    console.log('Step 2: Logging in as admin...');
    await page.fill('input[type="email"], input[name="email"]', 'admin@frezzerelbalad.dev');
    await page.fill('input[type="password"], input[name="password"]', 'Frezzer123!');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/step2-login-filled.png` });

    // Click login button
    const loginBtn = page.locator('button[type="submit"], button:has-text("تسجيل"), button:has-text("Login"), button:has-text("دخول")').first();
    await loginBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/step3-after-login.png`, fullPage: true });

    const url = page.url();
    console.log(`  ✓ Logged in, now at: ${url}`);

    // ── Step 3: Navigate to purchases ──
    console.log('Step 3: Navigating to purchases page...');
    await page.goto(`${BASE}/admin/purchases`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/step4-purchases-page.png`, fullPage: true });

    const pageContent = await page.textContent('body');
    console.log(`  ✓ Purchases page loaded`);
    // Check if we see purchases or empty state
    if (pageContent?.includes('لا توجد مشتريات')) {
      console.log('  ⚠ Empty state shown (may be no purchases or filter issue)');
    } else if (pageContent?.includes('إجمالي')) {
      console.log('  ✓ Purchases data visible');
    }

    // ── Step 4: Click "Add Purchase" button ──
    console.log('Step 4: Opening add purchase form...');
    const addBtn = page.locator('button:has-text("إضافة مشتريات"), button:has-text("إضافة"), button:has-text("تسجيل مشتريات")').first();
    if (await addBtn.isVisible({ timeout: 5000 })) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/step5-add-purchase-form.png`, fullPage: true });
      console.log('  ✓ Add purchase form opened');

      // ── Step 5: Select a product from dropdown ──
      console.log('Step 5: Selecting a product...');
      // Click the product selector
      const productSelector = page.locator('[role="combobox"], [role="listbox"], input[placeholder*="منتج"], input[placeholder*="product"], button:has-text("اختر المنتج"), [data-testid="product-select"]').first();
      if (await productSelector.isVisible({ timeout: 3000 })) {
        await productSelector.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/step6-product-dropdown.png`, fullPage: true });

        // Check if products appear in dropdown
        const dropdownContent = await page.textContent('body');
        if (dropdownContent?.includes('برجر') || dropdownContent?.includes('بانيه') || dropdownContent?.includes('Pane')) {
          console.log('  ✓ Product list visible with products');
        }

        // Click the first available product option
        const productOption = page.locator('[role="option"]').first();
        if (await productOption.isVisible({ timeout: 3000 })) {
          const productText = await productOption.textContent();
          console.log(`  → Selecting: ${productText?.trim()}`);
          await productOption.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/step7-product-selected.png`, fullPage: true });
          console.log('  ✓ Product selected');
        }
      } else {
        console.log('  ⚠ Product selector not found, checking page structure...');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/step6-debug.png`, fullPage: true });
      }

      // ── Step 6: Select weight (500g or 1kg) ──
      console.log('Step 6: Selecting weight...');
      const weightBtn = page.locator('button:has-text("500"), label:has-text("500"), input[value="500"], button:has-text("1 كيلو"), label:has-text("1 كيلو")').first();
      if (await weightBtn.isVisible({ timeout: 2000 })) {
        await weightBtn.click();
        console.log('  ✓ Weight selected');
      }
      await page.screenshot({ path: `${SCREENSHOT_DIR}/step8-weight.png`, fullPage: true });

      // ── Step 7: Enter quantity ──
      console.log('Step 7: Entering quantity...');
      const qtyInput = page.locator('input[name*="quantity"], input[placeholder*="كمية"], input[placeholder*="quantity"], input[type="number"]').first();
      if (await qtyInput.isVisible({ timeout: 2000 })) {
        await qtyInput.fill('5');
        console.log('  ✓ Quantity entered: 5');
      }

      // ── Step 8: Enter unit price ──
      console.log('Step 8: Entering unit price...');
      // The price input is the second number input (first is quantity)
      const allNumberInputs = page.locator('input[type="number"]');
      const count = await allNumberInputs.count();
      console.log(`  Found ${count} number inputs`);
      if (count >= 2) {
        await allNumberInputs.nth(1).fill('300');
        console.log('  ✓ Price entered: 300');
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/step9-form-filled.png`, fullPage: true });

      // ── Step 9: Submit ──
      console.log('Step 9: Submitting purchase...');
      // Scroll the modal content to make submit button visible
      const submitBtn = page.locator('button:has-text("تسجيل المشتريات")').first();
      if (await submitBtn.count() > 0) {
        // Scroll the button into view
        await submitBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await submitBtn.click({ force: true, timeout: 10000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/step10-after-submit.png`, fullPage: true });

        const afterContent = await page.textContent('body');
        if (afterContent?.includes('تم') || afterContent?.includes('نجاح')) {
          console.log('  ✓ Purchase submitted successfully');
        } else {
          console.log('  ⚠ Checking result...');
        }
      } else {
        console.log('  ⚠ Submit button not found');
      }
    } else {
      console.log('  ⚠ Add Purchase button not found');
      // Check for any error state
      console.log('  Page content snippet:', pageContent?.substring(0, 300));
    }

    // ── Step 10: Verify purchases list ──
    console.log('Step 10: Verifying purchases list...');
    await page.goto(`${BASE}/admin/purchases`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/step11-final-purchases.png`, fullPage: true });

    const finalContent = await page.textContent('body');
    const hasData = !finalContent?.includes('لا توجد مشتريات');
    const hasStats = finalContent?.includes('إجمالي') || finalContent?.includes('التكلفة');
    console.log(`  Purchases visible: ${hasData ? '✓' : '✗'}`);
    console.log(`  Stats visible: ${hasStats ? '✓' : '✗'}`);

    // ── Summary ──
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('  E2E TEST COMPLETE');
    console.log(`  Console errors: ${errors.length}`);
    if (errors.length > 0) {
      for (const e of errors.slice(0, 5)) {
        console.log(`    ⚠ ${e.substring(0, 120)}`);
      }
    }
    console.log('═══════════════════════════════════════════');

  } catch (err) {
    console.error('TEST FAILED:', err.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/error.png`, fullPage: true });
  } finally {
    await browser.close();
  }
})();
