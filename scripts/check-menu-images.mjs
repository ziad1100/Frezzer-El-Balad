// Loads the menu and a product page, counts rendered product images, flags any
// broken (failed-to-load) images, and saves screenshots for visual review.
// Usage: node scripts/check-menu-images.mjs [base-url] [out-dir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:5000';
const OUT = process.argv[3] || 'scripts/photo-candidates/ui-check';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });

const results = [];
const check = (label, ok, extra = '') => {
  results.push({ label, ok: Boolean(ok), extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${extra ? ` | ${extra}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForImages(page, min = 8, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = await page.evaluate(() => document.querySelectorAll('.group img').length);
    if (n >= min) return n;
    await sleep(500);
  }
  return 0;
}

try {
  await page.goto(`${BASE}/menu`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(3000);
  const imgCount = await waitForImages(page);
  check('menu renders product cards with images', imgCount >= 8, `images found: ${imgCount}`);
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.getAttribute('src')),
  );
  check('no broken images on /menu', broken.length === 0, broken.length ? broken.slice(0, 5).join(', ') : 'all good');
  await page.screenshot({ path: path.join(OUT, 'menu.png'), fullPage: false });

  // First product link → product page
  const href = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/product/"]');
    return a ? a.getAttribute('href') : null;
  });
  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2500);
    const heroImg = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')];
      return imgs.find((i) => i.naturalWidth > 100)?.getAttribute('src') ?? null;
    });
    check(`product page (${href}) shows a large dish photo`, Boolean(heroImg), heroImg ?? 'no large image');
    await page.screenshot({ path: path.join(OUT, 'product.png') });
  } else {
    check('found a product link to open', false);
  }
} catch (err) {
  check('script ran without errors', false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n[check-menu-images] ${results.length - failed}/${results.length} checks passed — screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
