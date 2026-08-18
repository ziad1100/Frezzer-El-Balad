import puppeteer from 'puppeteer-core';

const CHROME = process.env.SMOKE_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.SMOKE_BASE || 'http://localhost:5173';
const API = `${BASE}/api/v1`;

const results = [];
const check = (label, ok, extra = '') => {
  results.push({ label, ok: Boolean(ok), extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${extra ? ` | ${extra}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const goto = (page, url) => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

const safeText = async (page) => {
  try {
    return (await page.evaluate(() => document.body.innerText)) ?? '';
  } catch {
    return '';
  }
};

async function waitText(page, needle, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await safeText(page);
    const hit = typeof needle === 'string' ? text.includes(needle) : needle.test(text);
    if (hit) return true;
    await sleep(500);
  }
  return false;
}

async function waitLen(page, min = 200, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const len = (await safeText(page)).length;
    if (len >= min) return true;
    await sleep(500);
  }
  return false;
}

async function waitUrl(page, needle, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (page.url().includes(needle)) return true;
    await sleep(300);
  }
  return false;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--disable-gpu', '--no-first-run'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));

  await goto(page, `${BASE}/`);
  await waitLen(page, 200, 20000);
  const homeText = await page.evaluate(() => document.body.innerText);
  check('homepage renders content', homeText.length > 200, `${homeText.length} chars`);
  check('homepage rtl dir', await page.evaluate(() => document.documentElement.dir) === 'rtl');

  const productNames = [];
  try {
    const res = await fetch(`${API}/products?limit=5`);
    const json = await res.json();
    for (const p of json.data.items) productNames.push(p.name);
  } catch (e) {
    console.log('[fetch]', e.message);
  }

  await goto(page, `${BASE}/menu`);
  await waitText(page, productNames[0], 20000);
  const menuText = await page.evaluate(() => document.body.innerText);
  const foundName = productNames.find((n) => menuText.includes(n));
  check('menu renders product from API', Boolean(foundName), foundName ?? 'slice:' + menuText.slice(0, 80).replace(/\n/g, ' '));

  await goto(page, `${BASE}/gallery`);
  await waitText(page, 'Gallery', 15000);
  const galleryImgs = await page
    .waitForFunction(() => document.querySelectorAll('img[src^="/images/products/"]').length >= 4, { timeout: 20000 })
    .then(() => page.$$eval('img[src^="/images/products/"]', (imgs) => imgs.length))
    .catch(() => 0);
  check('gallery renders product images', galleryImgs >= 4, `${galleryImgs} images`);

  const smokeEmail = `smoke-reset-${Date.now()}@pizzahouse.dev`;
  try {
    const reg = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Smoke Reset', email: smokeEmail, password: 'Pizza123!', role: 'customer' }),
    });
    check('smoke account registered', reg.ok, `status ${reg.status}`);
  } catch (e) {
    check('smoke account registered', false, e.message);
  }

  await goto(page, `${BASE}/forgot-password`);
  await page.waitForSelector('#email', { timeout: 20000 });
  await page.type('#email', smokeEmail);
  await page.click('button[type=submit]');
  check('dev-mode shows reset code panel', await waitText(page, /Development mode|وضع التطوير/, 20000), '');
  const devCode = (await page.evaluate(() => document.body.innerText).then((t) => t.match(/\b\d{6}\b/)))?.[0] ?? '';
  check('dev panel shows 6-digit code', /^\d{6}$/.test(devCode), devCode);

  let resetOk = false;
  try {
    const reset = await fetch(`${API}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: devCode, password: 'Reset123!' }),
    });
    resetOk = reset.status === 200;
  } catch (e) {
    console.log('[reset]', e.message);
  }
  check('reset-password succeeds with dev code', resetOk, '');

  await goto(page, `${BASE}/reset-password`);
  check('reset-password without token shows OTP entry', await waitText(page, /Enter the reset code|أدخل كود إعادة التعيين/), '');

  await goto(page, `${BASE}/verify-email?token=definitely-bad-token`);
  check('verify-email with bad token shows failure', await waitText(page, /invalid or expired|غير صالح أو منتهي الصلاحية/, 30000), '');

  await goto(page, `${BASE}/login`);
  try {
    await page.waitForSelector('#email', { timeout: 20000 });
  } catch {
    await goto(page, `${BASE}/login`);
    await page.waitForSelector('#email', { timeout: 30000 });
  }
  await page.type('#email', smokeEmail);
  await page.type('#password', 'Reset123!');
  await page.click('button[type=submit]');
  const tR = Date.now();
  while (Date.now() - tR < 20000 && page.url().includes('/login')) await sleep(300);
  check('login works with new reset password', !page.url().includes('/login'), page.url());
  await page.evaluate(() => fetch('/api/v1/auth/logout', { method: 'POST' }));
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await goto(page, `${BASE}/login`);
  try {
    await page.waitForSelector('#email', { timeout: 20000 });
  } catch {
    await goto(page, `${BASE}/login`);
    await page.waitForSelector('#email', { timeout: 30000 });
  }
  await sleep(1200);
  const loginText = await page.evaluate(() => document.body.innerText);
  check('login page shows forgot-password link', /Forgot password\?|نسيت كلمة المرور؟/.test(loginText), '');
  await page.type('#email', 'admin@pizzahouse.dev');
  await page.type('#password', 'Pizza123!');
  await page.click('button[type=submit]');
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && page.url().includes('/login')) await sleep(300);
  check('admin login navigates', page.url().startsWith(`${BASE}/admin`), page.url());

  await goto(page, `${BASE}/admin`);
  await waitUrl(page, '/admin', 15000);
  await sleep(500);
  const adminText = await page.evaluate(() => document.body.innerText);
  check('admin dashboard renders', adminText.length > 200, `${adminText.length} chars`);

  await goto(page, `${BASE}/admin/products`);
  const waitProdRows = (p) => p.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 30000 }).then(() => p.$$eval('tbody tr', (r) => r.length)).catch(() => 0);
  let prodRows = await waitProdRows(page);
  if (prodRows === 0) {
    await goto(page, `${BASE}/admin/products`);
    prodRows = await waitProdRows(page);
  }
  check('admin/products table rows', prodRows > 0, `${prodRows} rows`);

  await goto(page, `${BASE}/admin/reviews`);
  const waitRevRows = (p) =>
    p.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 30000 }).then(() => p.$$eval('tbody tr', (r) => r.length)).catch(() => 0);
  let revRows = await waitRevRows(page);
  if (revRows === 0) {
    await goto(page, `${BASE}/admin/reviews`);
    revRows = await waitRevRows(page);
  }
  const revText = await page.evaluate(() => document.body.innerText);
  check('admin/reviews table rows', revRows > 0, `${revRows} rows`);
  check('admin/reviews columns translated', /التقييم|العميل|التعليق|Rating|Customer|Comment/.test(revText), '');

  check('menu rtl layout', await page.evaluate(() => document.documentElement.dir) === 'rtl');
} catch (err) {
  check('puppeteer run', false, err.message.split('\n')[0]);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);