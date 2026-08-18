import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Mobile menu layout regression tests.
 *
 * On phone-portrait widths (320–430px) every meal must render as ONE card per
 * row, ~90% of the viewport width, centered — so the +/- quantity buttons fit
 * inside the card and can never overlap. The multi-column grid starts at the
 * `sm` breakpoint (640px) and is covered by the desktop layout.
 *
 * Selectors are structural (no translated text): each card is wrapped in
 * <div class="w-[min(92%,26rem)] sm:w-full"> and contains a product link plus a
 * price row with the [-] [+] buttons.
 */

const MOBILE_WIDTHS = [320, 360, 375, 390, 412, 430];

/** The grid cell wrapper Playwright uses for product cards. */
const cardWrapper = (page: Page, index: number): Locator =>
  page.locator('[class*="w-[min(92%,26rem)]"]').nth(index);

/** Product link inside a card (stable, language-independent). */
const productLink = (page: Page, index: number): Locator =>
  page.locator('a[href^="/product/"]').nth(index);

/** The grid that contains a given card (its width = the content area). */
async function gridWidth(page: Page, index: number): Promise<number> {
  const grid = cardWrapper(page, index).locator('xpath=ancestor::div[contains(@class, "grid")][1]');
  const box = await grid.boundingBox();
  return box?.width ?? 0;
}

/** The [-]/[+] buttons of a card: nth(0) = minus, nth(1) = plus. */
const qtyButtons = (page: Page, index: number): Locator =>
  cardWrapper(page, index).locator('div.flex.items-center.justify-between').last().locator('button');

async function openMenu(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/menu');
  // Wait until the real product cards are rendered (the loading state uses the
  // same wrapper class for skeletons, so wait for an actual product link).
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('mobile menu layout (320–430px)', () => {
  for (const width of MOBILE_WIDTHS) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await openMenu(page, width);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test(`one card per row, ~90% width, centered at ${width}px`, async ({ page }) => {
      await openMenu(page, width);

      const count = await page.locator('a[href^="/product/"]').count();
      expect(count).toBeGreaterThan(0);

      const content = await gridWidth(page, 0);
      expect(content).toBeGreaterThan(0);

      let prevBottom = 0;
      for (let i = 0; i < count; i++) {
        const box = await productLink(page, i).boundingBox();
        expect(box, `card #${i} should be visible`).not.toBeNull();
        if (!box) continue;

        // The card is w-[min(92%,26rem)] of the content area — ~90% of the
        // available screen width (container padding applies on each side).
        expect(box.width).toBeGreaterThanOrEqual(content * 0.88);
        expect(box.width).toBeLessThanOrEqual(content * 0.94);

        // Centered horizontally in the viewport.
        expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThanOrEqual(6);

        // Stacked one per row: each card starts below the previous card's end.
        expect(box.y).toBeGreaterThanOrEqual(prevBottom - 1);
        prevBottom = box.y + box.height;
      }
    });

    test(`qty +/- buttons fit inside the card without overlapping at ${width}px`, async ({ page }) => {
      await openMenu(page, width);

      const count = await page.locator('a[href^="/product/"]').count();
      const sample = Math.min(count, 3);
      expect(sample).toBeGreaterThan(0);

      for (let i = 0; i < sample; i++) {
        const cardBox = await cardWrapper(page, i).boundingBox();
        const buttons = qtyButtons(page, i);
        expect(await buttons.count()).toBe(2);

        const minus = await buttons.nth(0).boundingBox();
        const plus = await buttons.nth(1).boundingBox();
        expect(minus, `card #${i} minus button`).not.toBeNull();
        expect(plus, `card #${i} plus button`).not.toBeNull();
        if (!minus || !plus || !cardBox) continue;

        // Both buttons fully inside the card (no clipping).
        expect(minus.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(plus.x + plus.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
        expect(minus.y).toBeGreaterThanOrEqual(cardBox.y - 1);
        expect(plus.y + plus.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);

        // Both fully inside the viewport.
        expect(minus.x).toBeGreaterThanOrEqual(0);
        expect(plus.x + plus.width).toBeLessThanOrEqual(width + 1);

        // Tap-friendly size (h-10/w-10 = 40px).
        expect(minus.width).toBeGreaterThanOrEqual(40);
        expect(plus.width).toBeGreaterThanOrEqual(40);

        // Never overlap — whichever order (LTR/RTL), one ends before the other starts.
        expect(Math.max(minus.x, plus.x)).toBeGreaterThanOrEqual(
          Math.min(minus.x, plus.x) + Math.min(minus.width, plus.width) - 0.5,
        );
      }
    });
  }
});
