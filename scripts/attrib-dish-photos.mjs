#!/usr/bin/env node
// Records attribution for every dish photo from Wikimedia Commons without
// touching files. Two phases keep API calls low:
//   A) search each dish once (cached in scripts/.attrib-titles.json)
//   B) one batched imageinfo lookup per ~48 titles
// Then the same top-ranked pick as the downloader is recorded. Files sourced
// from Openverse are merged over these entries later.
// Output: scripts/dish-photo-attribution.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN = path.join(ROOT, 'scripts', 'dish-photo-plan.json');
const TITLE_CACHE = path.join(ROOT, 'scripts', '.attrib-titles.json');
const REPORT = path.join(ROOT, 'scripts', 'dish-photo-attribution.json');

const UA = 'orabi-menu-tool/1.0 (menu rework)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

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

const fetchWithRetry = async (url, tries = 6) => {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? '') || 3 + attempt * 5;
      console.warn(`[429] retrying in ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    return res;
  }
  throw new Error('rate-limited after 6 attempts');
};

const api = async (params) => {
  const res = await fetchWithRetry(`${COMMONS}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`Commons ${res.status}`);
  return res.json();
};

const search = async (q) => {
  const body = await api({
    action: 'query', list: 'search', srsearch: q, srnamespace: '6',
    srlimit: '15', format: 'json', origin: '*',
  });
  await sleep(500);
  return (body.query?.search ?? []).map((r) => r.title);
};

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));

// Phase A — collect up to 8 candidate titles per file (cached).
let titlesByFile = {};
if (fs.existsSync(TITLE_CACHE)) {
  titlesByFile = JSON.parse(fs.readFileSync(TITLE_CACHE, 'utf8'));
}
const todo = plan.filter((r) => !titlesByFile[r.file]);
console.log(`[attrib] phase A: searching ${todo.length} dishes (${plan.length - todo.length} cached)`);

const CONCURRENCY = 3;
const jobs = [...todo];
const searchWorker = async () => {
  while (jobs.length > 0) {
    const row = jobs.shift();
    const queries = QUERIES[row.file] ?? [row.en, `${row.sub} ${row.en}`];
    const titles = [];
    for (const q of queries) {
      try {
        const found = await search(q);
        titles.push(...found.filter((t) => !titles.includes(t)));
        if (titles.length >= 8) break;
      } catch (err) {
        console.error(`[search] ${row.file} "${q}": ${err.message}`);
      }
    }
    titlesByFile[row.file] = titles.slice(0, 8);
    fs.writeFileSync(TITLE_CACHE, JSON.stringify(titlesByFile));
  }
};
await Promise.all(Array.from({ length: CONCURRENCY }, searchWorker));

// Phase B — one batched imageinfo lookup per ~48 titles.
const allTitles = [...new Set(Object.values(titlesByFile).flat())];
const infosByTitle = new Map();
const chunks = [];
for (let i = 0; i < allTitles.length; i += 48) chunks.push(allTitles.slice(i, i + 48));
console.log(`[attrib] phase B: ${chunks.length} batched lookups over ${allTitles.length} titles`);
for (let i = 0; i < chunks.length; i += 1) {
  const body = await api({
    action: 'query', titles: chunks[i].join('|'), prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: '900', format: 'json', origin: '*',
  });
  await sleep(500);
  for (const p of Object.values(body.query?.pages ?? {})) {
    if (p.imageinfo?.[0]) infosByTitle.set(p.title, { title: p.title, ...p.imageinfo[0] });
  }
  console.log(`  lookup ${i + 1}/${chunks.length}`);
}

// Phase C — same top-ranked pick as the downloader.
const ext = (meta) => meta?.extmetadata ?? {};
const plain = (x) => x?.value ?? '';
const licenseOk = (ii) => {
  const lic = plain(ext(ii).LicenseShortName) || plain(ext(ii).License) || '';
  if (!lic) return false;
  const lower = lic.toLowerCase();
  if (/nc|nd|non[- ]commercial|no[- ]deriv/.test(lower)) return false;
  return /cc|public domain|pdm|cc0/i.test(lower);
};
const words = (q) => q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const score = (title, queries) => {
  const t = title.toLowerCase();
  const [q, fb] = queries;
  const qs = words(q).reduce((s, w) => s + (t.includes(w) ? 2 : 0), 0);
  const fs = words(fb ?? '').reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
  return qs + fs;
};

const report = [];
for (const row of plan) {
  const queries = QUERIES[row.file] ?? [row.en, `${row.sub} ${row.en}`];
  const usable = (titlesByFile[row.file] ?? [])
    .map((t) => infosByTitle.get(t))
    .filter((ii) => ii && ii.thumburl && ['image/jpeg', 'image/png', 'image/webp'].includes(ii.mime))
    .filter(licenseOk)
    .map((ii) => ({ ...ii, _score: score(ii.title, queries) }))
    .sort((a, b) => b._score - a._score);
  const top = usable[0];
  if (top) {
    report.push({
      file: row.file, title: top.title,
      license: plain(ext(top).LicenseShortName) || plain(ext(top).License),
      artist: plain(ext(top).Artist).replace(/<[^>]+>/g, '').slice(0, 120),
      url: top.url, width: top.width, height: top.height, source: 'commons',
    });
  } else {
    report.push({ file: row.file, title: null, license: null, artist: null, url: null, source: 'commons' });
  }
}

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`[attrib] DONE: ${report.filter((r) => r.title).length}/${report.length} attributed → ${REPORT}`);
