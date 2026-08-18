#!/usr/bin/env node
// Provisions dish photos for the ORABI menu catalog.
//
// Strategy (per item, in order):
//   1. REUSE_MAP  - keep an existing legacy photo for an item whose dish
//                   visually matches the old catalog (real photo, zero cost).
//   2. EXISTING   - the derived filename already exists in public/images/products.
//   3. DOWNLOAD   - fetch a royalty-free photo from the Openverse API
//                   (commercial-license images only) named <slug>-<sub>.jpg.
//   4. PLACEHOLDER- write an SVG placeholder under the same name so the seed
//                   hard-fail for missing photos never triggers.
//
// Emits scripts/menu-photo-map.json: one row per item with its source so the
// photo strategy can be reviewed before committing.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MENU = JSON.parse(fs.readFileSync(path.join(ROOT, 'orabi_menu.json'), 'utf8'));
const PRODUCTS_DIR = path.join(ROOT, 'public', 'images', 'products');
const OUT_JSON = path.join(ROOT, 'scripts', 'menu-photo-map.json');

// Icons kept from the legacy seed vocabulary.
const REUSE_MAP = {
  19: 'mozzarella-cheese.jpg', // Add-ons: Mozzarella
  20: 'chicken-chicken.jpg',   // Add-ons: Chicken
  21: 'beef-meat.jpg',         // Add-ons: Meat
  22: 'kiri-cheese-cheese.jpg', // Add-ons: Kiri piece
  48: 'mozzarella-cheese.jpg', // Assorted Crepe: Mozzarella
  49: 'roumy-cheese-cheese.jpg', // Assorted Crepe: Roman cheese
  63: 'custard-sweet-feteer.jpg', // Dessert: Custard
  65: 'chocolate-sweet-feteer.jpg',   // Sweet Crepe: Chocolate
  66: 'chocolate-banana-sweet-feteer.jpg', // Sweet Crepe: Chocolate banana
  67: 'chocolate-oreo-sweet-feteer.jpg',   // Sweet Crepe: Chocolate oreo
  68: 'lotus-sweet-feteer.jpg',   // Sweet Crepe: Lotus
};

// Mirrors slugify(text, { lower: true, strict: true }) for ASCII names.
const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

const subEn = (category) => category.split(' - ')[0].trim();

const OPENVERSE = 'https://api.openverse.org/v1/images/';
const UA = 'orabi-menu-tool/1.0 (menu rework)';

const searchOpenverse = async (query) => {
  const url = `${OPENVERSE}?q=${encodeURIComponent(query)}&license_type=commercial&page_size=8&mature=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const body = await res.json();
  return body.results ?? [];
};

const download = async (src) => {
  const res = await fetch(src, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
  return Buffer.from(await res.arrayBuffer());
};

const placeholder = (name) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#16161f"/>
  <circle cx="400" cy="250" r="110" fill="#2b2b3d"/>
  <text x="400" y="265" font-family="Segoe UI, Arial" font-size="44" text-anchor="middle" fill="#f5c04a">&#127858;</text>
  <text x="400" y="420" font-family="Segoe UI, Arial" font-size="30" text-anchor="middle" fill="#e7e7ef">${name}</text>
  <text x="400" y="470" font-family="Segoe UI, Arial" font-size="18" text-anchor="middle" fill="#8a8aa3">picture coming soon - الصورة قريباً</text>
</svg>`;

const plan = [];
for (const item of MENU.menu_items) {
  const sub = subEn(item.category);
  const file = `${slug(item.english_name)}-${slug(sub)}.jpg`;
  const targetPath = path.join(PRODUCTS_DIR, file);
  plan.push({ ...item, sub, file, targetPath });
}

let downloaded = 0;
let placeholders = 0;
const CONCURRENCY = 4;

const worker = async (queue, run) => {
  while (queue.length > 0) {
    const job = queue.shift();
    try {
      await run(job);
    } catch (err) {
      console.error(`[menu-photos] FAILED ${job.file}: ${err.message}`);
    }
  }
};

const jobs = [];
for (const row of plan) {
  const reused = REUSE_MAP[row.id];
  if (reused) {
    if (!fs.existsSync(path.join(PRODUCTS_DIR, reused))) {
      throw new Error(`[menu-photos] REUSE_MAP references a missing file: ${reused}`);
    }
    row.source = 'reused';
    row.photo = reused;
    continue;
  }
  if (fs.existsSync(row.targetPath)) {
    row.source = 'existing';
    continue;
  }
  jobs.push(row);
}

console.log(`[menu-photos] ${plan.length} items: ${plan.filter((r) => r.source === 'reused').length} reused, ` +
  `${plan.filter((r) => r.source === 'existing').length} existing, ${jobs.length} to fetch`);

const run = async (row) => {
  const query = row.english_name.toLowerCase().includes('water') ? 'bottled water drink' : `${row.english_name} food`;
  const results = await searchOpenverse(query);
  for (const hit of results) {
    const src = hit.thumbnail ?? hit.url;
    if (!src) continue;
    try {
      const buf = await download(src);
      fs.writeFileSync(row.targetPath, buf);
      row.source = 'downloaded';
      row.photo = row.file;
      row.credit = `${hit.license ?? ''} ${hit.license_version ?? ''}`;
      row.attribution = hit.creator;
      row.sourceUrl = src;
      downloaded += 1;
      console.log(`  downloaded ${row.file} <- ${src}`);
      return;
    } catch {
      continue; // try the next hit
    }
  }
  fs.writeFileSync(row.targetPath, placeholder(row.english_name));
  row.source = 'placeholder';
  row.photo = row.file;
  placeholders += 1;
  console.log(`  placeholder  ${row.file}`);
};

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(jobs, run)));

const report = plan.map(({ id, arabic_name, english_name, category, sub, file, source, photo, credit, attribution, sourceUrl }) => ({
  id, arabic_name, english_name, category, sub, file, source, photo, credit, attribution, sourceUrl,
}));
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log(`[menu-photos] DONE: ${plan.length} opted, ${downloaded} downloaded, ${placeholders} placeholders, ${plan.filter((r) => r.source === 'reused').length} reused, ${plan.filter((r) => r.source === 'existing').length} existing`);
console.log(`[menu-photos] report: ${OUT_JSON}`);