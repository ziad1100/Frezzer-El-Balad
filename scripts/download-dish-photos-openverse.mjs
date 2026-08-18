#!/usr/bin/env node
// Openverse fallback for dish photos: replaces any SVG-content placeholder in
// public/images/products with a real commercial-license photo (CC0 / PD / BY /
// BY-SA — license_type=commercial excludes NC/ND). Reads the same
// scripts/dish-photo-plan.json + QUERIES as the Commons downloader so naming
// always matches seed.ts imageFor(). Idempotent: real images are never
// overwritten.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'images', 'products');
const PLAN = path.join(ROOT, 'scripts', 'dish-photo-plan.json');
const REPORT = path.join(ROOT, 'scripts', 'dish-photo-openverse-report.json');

const UA = 'orabi-menu-tool/1.0 (menu rework)';
const OPENVERSE = 'https://api.openverse.org/v1/images/';

const QUERIES = {
  'alexandrian-sausage-crepe-meat-crepe.jpg': ['sausage wrap', 'sausage roll'],
  'alexandrian-sausage-pizza-meat.jpg': ['sujuk pizza', 'sausage pizza'],
  'alfredo-pasta-pasta.jpg': ['fettuccine alfredo', 'creamy white sauce pasta'],
  'baked-mozzarella-potato-appetizers.jpg': ['baked potato cheese', 'cheesy baked potato'],
  'baked-rice-dessert.jpg': ['rice pudding', 'milk rice dessert'],
  'baladi-sausage-crepe-meat-crepe.jpg': ['sausage roll', 'grilled sausage wrap'],
  'baladi-sausage-pizza-meat.jpg': ['sausage pizza', 'sucuk pizza'],
  'bbq-chicken-crepe-chicken-crepe.jpg': ['chicken crepe', 'chicken wrap'],
  'bbq-chicken-pizza-chicken.jpg': ['bbq chicken pizza', 'barbecue chicken pizza'],
  'cheddar-potato-appetizers.jpg': ['loaded cheese fries', 'cheese fries'],
  'cheddar-potato-crepe-assorted-crepe.jpg': ['potato cheese crepe', 'potato galette'],
  'cheese-mix-crepe-mix-crepe.jpg': ['cheese crepe', 'cheese galette'],
  'cheese-mix-hawawshi-hawawshi.jpg': ['cheese stuffed bread', 'cheese pie pastry'],
  'cheese-mix-pizza-mixes.jpg': ['four cheese pizza', 'cheese pizza'],
  'chicken-add-ons.jpg': ['grilled chicken pieces', 'chicken chunks'],
  'chicken-fajita-crepe-chicken-crepe.jpg': ['chicken fajita wrap', 'fajita burrito'],
  'chicken-hawawshi-hawawshi.jpg': ['chicken shawarma sandwich', 'gyro wrap'],
  'chicken-mix-crepe-mix-crepe.jpg': ['chicken crepe', 'chicken wrap'],
  'chicken-mix-hawawshi-hawawshi.jpg': ['chicken wrap', 'shawarma wrap'],
  'chicken-mix-pizza-mixes.jpg': ['chicken pizza', 'chicken topping pizza'],
  'chicken-mix-tagine-tagine.jpg': ['chicken tagine', 'moroccan chicken'],
  'chicken-mozzarella-tagine-tagine.jpg': ['chicken tagine', 'cheesy chicken bake'],
  'chicken-pasta-pasta.jpg': ['chicken pasta', 'creamy chicken pasta'],
  'chicken-pizza-chicken.jpg': ['chicken pizza', 'chicken topping pizza'],
  'chicken-ranch-pizza-chicken.jpg': ['chicken pizza', 'ranch chicken pizza'],
  'chicken-shawarma-crepe-chicken-crepe.jpg': ['chicken shawarma wrap', 'shawarma'],
  'chicken-strips-pizza-chicken.jpg': ['chicken tenders pizza', 'chicken strips pizza'],
  'chicken-tagine-tagine.jpg': ['chicken tagine', 'moroccan chicken tagine'],
  'chocolate-banana-crepe-sweet-crepe.jpg': ['chocolate banana crepe', 'banana nutella crepe'],
  'chocolate-crepe-sweet-crepe.jpg': ['chocolate crepe', 'nutella crepe'],
  'chocolate-oreo-crepe-sweet-crepe.jpg': ['oreo crepe', 'chocolate cookie crepe'],
  'crispy-chicken-crepe-chicken-crepe.jpg': ['crispy chicken wrap', 'chicken wrap'],
  'crispy-chicken-pizza-chicken.jpg': ['crispy chicken pizza', 'chicken pizza'],
  'crispy-pizza-chicken.jpg': ['crispy chicken pizza', 'chicken pizza'],
  'crunchy-chicken-crepe-chicken-crepe.jpg': ['crispy chicken wrap', 'crunchy wrap'],
  'crunchy-chicken-pizza-chicken.jpg': ['crispy chicken pizza', 'chicken pizza'],
  'custard-dessert.jpg': ['custard dessert', 'custard cream'],
  'estris-crepe-chicken-crepe.jpg': ['chicken crepe', 'savory crepe'],
  'fajita-pizza-chicken.jpg': ['fajita pizza', 'chicken fajita pizza'],
  'helwany-mix-pizza-mixes.jpg': ['mixed meat pizza', 'meat pizza'],
  'hot-dog-crepe-meat-crepe.jpg': ['hot dog roll', 'hot dog bread'],
  'hot-dog-pasta-pasta.jpg': ['hot dog pasta', 'sausage pasta'],
  'jumbo-can-delivery-cans.jpg': ['foil tray food', 'large takeaway container'],
  'kiri-cheese-piece-add-ons.jpg': ['kiri cheese', 'cream cheese portions'],
  'kiri-cheese-pizza-cheese.jpg': ['cream cheese pizza', 'cheese pizza'],
  'kofta-crepe-meat-crepe.jpg': ['kebab wrap', 'adana kebab'],
  'kofta-pizza-meat.jpg': ['kebab pizza', 'kofta pizza'],
  'legend-mix-crepe-mix-crepe.jpg': ['loaded crepe', 'supreme crepe'],
  'lotus-crepe-sweet-crepe.jpg': ['lotus biscoff crepe', 'biscoff dessert crepe'],
  'margherita-pizza-cheese.jpg': ['margherita pizza', 'mozzarella tomato pizza'],
  'meat-add-ons.jpg': ['raw beef steak', 'beef cut meat'],
  'meat-burger-crepe-meat-crepe.jpg': ['burger wrap', 'beef burger'],
  'meat-crepe-meat-crepe.jpg': ['meat crepe', 'savory crepe meat'],
  'meat-hawawshi-hawawshi.jpg': ['pide meat', 'kibbeh'],
  'meat-mix-hawawshi-hawawshi.jpg': ['lahmacun', 'stuffed flatbread'],
  'meat-mix-pizza-mixes.jpg': ['meat lovers pizza', 'meat pizza'],
  'meat-mix-tagine-tagine.jpg': ['meat tagine', 'grilled meat tagine'],
  'meat-mozzarella-tagine-tagine.jpg': ['karniyarik', 'pastitsio'],
  'meat-pasta-pasta.jpg': ['bolognese pasta', 'spaghetti bolognese'],
  'meat-tagine-tagine.jpg': ['beef tagine', 'moroccan meat tagine'],
  'mexican-hot-dog-crepe-meat-crepe.jpg': ['mexican hot dog', 'hot dog jalapeno'],
  'minced-meat-pizza-meat.jpg': ['minced meat pizza', 'ground beef pizza'],
  'mozzarella-add-ons.jpg': ['mozzarella cheese', 'mozzarella'],
  'mozzarella-crepe-assorted-crepe.jpg': ['mozzarella crepe', 'cheese crepe'],
  'mozzarella-pizza-cheese.jpg': ['mozzarella pizza', 'cheese pizza'],
  'mushroom-crepe-assorted-crepe.jpg': ['mushroom crepe', 'mushroom galette'],
  'napolitana-pasta-pasta.jpg': ['napolitana pasta', 'tomato basil pasta'],
  'negresco-pasta-pasta.jpg': ['bechamel pasta', 'bolognese pasta'],
  'orabi-can-delivery-cans.jpg': ['takeaway food box', 'kraft food container'],
  'orabi-qalbana-crepe-mix-crepe.jpg': ['savory crepe', 'cheese crepe'],
  'orabi-revolution-pizza-mixes.jpg': ['supreme pizza', 'loaded pizza'],
  'pastrami-pizza-meat.jpg': ['pastrami pizza', 'meat pizza'],
  'pate-crepe-chicken-crepe.jpg': ['chicken liver pate', 'savory crepe'],
  'potato-bag-appetizers.jpg': ['french fries', 'chips fries'],
  'potato-crepe-assorted-crepe.jpg': ['potato crepe', 'potato galette'],
  'ranch-chicken-crepe-chicken-crepe.jpg': ['chicken wrap', 'ranch wrap'],
  'regular-can-delivery-cans.jpg': ['takeaway food box', 'kraft food container'],
  'regular-rice-dessert.jpg': ['white rice bowl', 'cooked rice plate'],
  'roman-cheese-crepe-assorted-crepe.jpg': ['cheese crepe', 'cheese galette'],
  'roman-cheese-pizza-cheese.jpg': ['roman cheese pizza', 'cheese pizza'],
  'salami-pizza-meat.jpg': ['salami pizza', 'meat pizza'],
  'sausage-hawawshi-hawawshi.jpg': ['sausage sandwich', 'sujuk sausage'],
  'sausage-pasta-pasta.jpg': ['sausage pasta', 'sausage spaghetti'],
  'sausage-pizza-meat.jpg': ['sausage pizza', 'salami pizza'],
  'seafood-pizza-seafood.jpg': ['seafood pizza', 'mixed seafood pizza'],
  'sekket-alia-crepe-mix-crepe.jpg': ['chicken crepe', 'savory crepe'],
  'shawarma-pane-mix-crepe-mix-crepe.jpg': ['shawarma wrap', 'chicken shawarma'],
  'shawarma-potato-bbq-mix-crepe-mix-crepe.jpg': ['shawarma wrap', 'bbq chicken wrap'],
  'shish-pizza-chicken.jpg': ['shish kebab', 'chicken kebab'],
  'shrimp-pasta-pasta.jpg': ['shrimp pasta', 'prawn pasta'],
  'shrimp-pizza-seafood.jpg': ['shrimp pizza', 'prawn pizza'],
  'smoked-helwany-mix-pizza-mixes.jpg': ['smoked meat pizza', 'meat pizza'],
  'smoked-turkey-pizza-chicken.jpg': ['turkey pizza', 'smoked turkey'],
  'super-can-delivery-cans.jpg': ['biryani foil', 'biryani tray'],
  'super-crunchy-crepe-mix-crepe.jpg': ['crispy chicken crepe', 'crispy wrap'],
  'super-supreme-pizza-mixes.jpg': ['supreme pizza', 'loaded pizza'],
  'tuna-hawawshi-hawawshi.jpg': ['tuna sandwich toasted', 'tuna pie'],
  'tuna-pizza-seafood.jpg': ['tuna pizza', 'tuna onion pizza'],
  'vegetable-pizza-cheese.jpg': ['vegetable pizza', 'veggie pizza'],
  'water-dessert.jpg': ['plastic water bottle', 'transparent water bottle'],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isSvg = (p) => {
  if (!fs.existsSync(p)) return true;
  return fs.readFileSync(p).slice(0, 200).toString('utf8').trimStart().startsWith('<svg');
};

const words = (q) => q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

const score = (hit, queries) => {
  const text = `${hit.title ?? ''} ${(hit.tags ?? []).join(' ')}`.toLowerCase();
  const [q, fb] = queries;
  const qs = words(q).reduce((s, w) => s + (text.includes(w) ? 2 : 0), 0);
  const fs = words(fb ?? '').reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
  return qs + fs;
};

const search = async (q, row) => {
  const url = `${OPENVERSE}?q=${encodeURIComponent(q)}&license_type=commercial&page_size=12&mature=false`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const body = await res.json();
  await sleep(250);
  const results = body.results ?? [];
  return results
    .map((r) => ({ ...r, _score: score(r, [q, QUERIES[row.file]?.[1] ?? '']) }))
    .sort((a, b) => b._score - a._score);
};

const download = async (src) => {
  const res = await fetch(src, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
  return Buffer.from(await res.arrayBuffer());
};

const args = process.argv.slice(2);
const onlyArg = args[args.indexOf('--only') + 1];
const skipFirst = Number(args[args.indexOf('--skip') + 1] ?? 0) || 0;
const force = args.includes('--force');

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
const report = [];
const queue = plan.filter((r) => {
  if (onlyArg && r.file !== onlyArg) return false;
  return force || isSvg(path.join(PRODUCTS_DIR, r.file));
});
console.log(`[openverse] ${queue.length} files to fetch (skip ${skipFirst} best-ranked hit(s))`);

const pickFor = async (row) => {
  const queries = QUERIES[row.file] ?? [row.en, `${row.sub} ${row.en}`];
  let hits = [];
  for (const q of queries) {
    try {
      hits = await search(q, row);
      if (hits.length) break;
    } catch (err) {
      console.error(`[search] ${row.file} "${q}": ${err.message}`);
    }
  }
  for (const hit of hits.slice(skipFirst)) {
    const src = hit.thumbnail ?? hit.url;
    if (!src) continue;
    try {
      const buf = await download(src);
      if (!(buf[0] === 0xff && buf[1] === 0xd8) && buf.slice(0, 4).toString('utf8') !== '\x89PNG') continue;
      fs.writeFileSync(path.join(PRODUCTS_DIR, row.file), buf);
      report.push({
        file: row.file, status: 'downloaded', title: hit.title ?? '',
        license: `${hit.license ?? ''}${hit.license_version ? ` ${hit.license_version}` : ''}`,
        artist: hit.creator ?? '', url: src, provider: hit.provider ?? '',
      });
      console.log(`  downloaded ${row.file} <- ${hit.title ?? '(no title)'} [${hit.provider ?? '?'}] (${buf.length} bytes)`);
      return;
    } catch (err) {
      continue; // try next hit
    }
  }
  report.push({ file: row.file, status: 'failed' });
  console.error(`  FAILED ${row.file} — no usable Openverse image`);
};

const CONCURRENCY = 3;
const jobs = [...queue];
const worker = async () => {
  while (jobs.length > 0) {
    const row = jobs.shift();
    try {
      await pickFor(row);
    } catch (err) {
      console.error(`  ERROR ${row.file}: ${err.message}`);
      report.push({ file: row.file, status: 'error' });
    }
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
const ok = report.filter((r) => r.status === 'downloaded').length;
const fail = report.filter((r) => r.status !== 'downloaded').length;
console.log(`\n[openverse] DONE: ${ok} downloaded, ${fail} failed → report: ${REPORT}`);
