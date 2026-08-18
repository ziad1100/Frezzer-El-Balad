#!/usr/bin/env node
/**
 * Download RAW / uncooked / frozen product images.
 *
 * Strategy: Wikipedia article images (infobox photos) — almost always show
 * the raw ingredient, high quality, and freely licensed.
 * Falls back to Wikimedia Commons search if Wikipedia has no image.
 *
 * Usage: node scripts/download-raw-product-images.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'images', 'products');
const UA = 'frezzer-el-balad-menu/1.0 (educational)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

// ── Item mapping: id → { slug, wikipediaQuery, commonsFallback } ───────────
const ITEMS = [
  { id: 1,  slug: 'flank-meat-fresh-meat',        wiki: 'Flank steak',             commons: 'raw flank steak beef' },
  { id: 2,  slug: 'steak-meat-fresh-meat',         wiki: 'Beef steak',              commons: 'raw beef steak cut' },
  { id: 3,  slug: 'beef-liver-liver',              wiki: 'Liver (food)',             commons: 'raw beef liver fresh' },
  { id: 4,  slug: 'american-liver-liver',          wiki: 'Liver (food)',             commons: 'liver slices raw' },
  { id: 5,  slug: 'eastern-sausage-sausage-sosis', wiki: 'Sujuk',                   commons: 'raw sujuk sausage' },
  { id: 6,  slug: 'goulash-other-products',        wiki: 'Börek',                   commons: 'raw börek pastry' },
  { id: 7,  slug: 'sosis-sausage-sosis',           wiki: 'Sausage',                 commons: 'raw sausage links' },
  { id: 8,  slug: 'wings-frozen-chicken',          wiki: 'Chicken wing',            commons: 'raw chicken wings frozen' },
  { id: 9,  slug: 'baladi-burger-burger-kofta',    wiki: 'Hamburger',               commons: 'raw hamburger patty' },
  { id: 10, slug: 'burger-burger-kofta',           wiki: 'Hamburger',               commons: 'raw beef burger uncooked' },
  { id: 11, slug: 'minced-meat-fresh-meat',        wiki: 'Ground meat',             commons: 'raw minced meat' },
  { id: 12, slug: 'strips-burger-kofta',           wiki: 'Chicken tender',          commons: 'raw chicken tenders' },
  { id: 13, slug: 'shish-frozen-chicken',          wiki: 'Shish kebab',            commons: 'raw chicken kebab skewer' },
  { id: 14, slug: 'pane-pane-strips',              wiki: 'Schnitzel',              commons: 'raw breaded chicken cutlet' },
  { id: 15, slug: 'mozzarella-pane-pane-strips',   wiki: 'Mozzarella in carrozza',  commons: 'raw breaded mozzarella' },
  { id: 16, slug: 'baladi-kebab-other-products',   wiki: 'Kebab',                  commons: 'raw kofta kebab skewer' },
  { id: 17, slug: 'kofta-burger-kofta',            wiki: 'Kofta',                  commons: 'raw kofta meat' },
  { id: 18, slug: 'hawawshi-hawawshi',             wiki: 'Hawawshi',               commons: 'raw stuffed pita bread' },
  { id: 19, slug: 'chicken-hawawshi-hawawshi',     wiki: 'Hawawshi',               commons: 'raw chicken stuffed bread' },
  { id: 20, slug: 'rice-hawawshi-hawawshi',        wiki: 'Hawawshi',               commons: 'raw rice stuffed flatbread' },
  { id: 21, slug: 'baladi-hawawshi-hawawshi',      wiki: 'Hawawshi',               commons: 'raw meat stuffed pita' },
];

// ── Wikipedia image fetcher ─────────────────────────────────────────────────

const fetchRetry = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000), redirect: 'follow' });
    if (res.status === 429) { await sleep(5000 * (i + 1)); continue; }
    return res;
  }
  throw new Error('failed after retries');
};

/** Get the main image URL from a Wikipedia article */
const getWikiImage = async (title) => {
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetchRetry(apiUrl);
  if (!res.ok) return null;
  const data = await res.json();
  return data.thumbnail?.source ?? data.originalimage?.source ?? null;
};

/** Get ALL images from a Wikipedia article (for picking the best raw one) */
const getWikiImages = async (title) => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images&format=json&origin=*`;
  const res = await fetchRetry(url);
  if (!res.ok) return [];
  const data = await res.json();
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return (page?.images ?? []).map((img) => img.title);
};

/** Get the actual URL for a Wikipedia image file */
const getWikiFileUrl = async (fileTitle) => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=900&format=json&origin=*`;
  const res = await fetchRetry(url);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  return { url: info.thumburl || info.url, width: info.width, height: info.height, mime: info.mime };
};

/** Filter for food-relevant images, prefer raw/uncooked */
const isFoodImage = (title) => {
  const t = title.toLowerCase();
  // Skip SVG, icons, logos, maps, diagrams
  if (/\.svg|icon|logo|map|diagram|symbol|flag|stamp|coin|map|chart|graph/.test(t)) return false;
  // Must be an image file
  if (!/\.(jpg|jpeg|png|webp)/i.test(t)) return false;
  return true;
};

const preferRaw = (title) => {
  const t = title.toLowerCase();
  // Prefer raw/frozen/uncooked keywords
  if (/raw|fresh|frozen|uncook|whole|cut|slice|piece|ingredient|meat|beef|chicken/.test(t)) return 10;
  // Accept neutral food images
  if (/food|dish|meal|cook|grill|fry|bake|prepare/.test(t)) return 5;
  // Lower priority for plated/cooked
  if (/plate|served|restaurant|menu|ready/.test(t)) return 2;
  return 1;
};

// ── Wikimedia Commons fallback ──────────────────────────────────────────────

const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const commonsSearch = async (q) => {
  const url = `${COMMONS}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srnamespace=6&srlimit=10&format=json&origin=*`;
  const res = await fetchRetry(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.query?.search ?? []).map((r) => r.title);
};

const commonsInfo = async (titles) => {
  if (!titles.length) return [];
  const url = `${COMMONS}?action=query&titles=${titles.map(encodeURIComponent).join('|')}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=900&format=json&origin=*`;
  const res = await fetchRetry(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Object.values(data.query?.pages ?? {})
    .filter((p) => p.imageinfo?.[0])
    .map((p) => ({ title: p.title, ...p.imageinfo[0] }));
};

// ── Download ────────────────────────────────────────────────────────────────

const downloadFile = async (url) => {
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

const placeholder = (name) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#16161f"/>
  <text x="400" y="265" font-size="44" text-anchor="middle" fill="#38BDF8">❄️</text>
  <text x="400" y="340" font-size="28" text-anchor="middle" fill="#e7e7ef">${name}</text>
  <text x="400" y="400" font-size="18" text-anchor="middle" fill="#8a8aa3">image coming soon</text>
</svg>`;

// ── Main ────────────────────────────────────────────────────────────────────

const onlyId = process.argv.includes('--only') ? Number(process.argv[process.argv.indexOf('--only') + 1]) : null;
const items = onlyId ? ITEMS.filter((it) => it.id === onlyId) : ITEMS;
let ok = 0, fail = 0;

console.log(`\n[raw-images] Downloading ${items.length} product images (RAW state)\n`);

for (const item of items) {
  const dest = path.join(PRODUCTS_DIR, `${item.slug}.jpg`);
  const label = `#${item.id} ${item.slug}`;
  let downloaded = false;

  // ── Strategy 1: Wikipedia images ─────────────────────────────────────────
  try {
    const images = await getWikiImages(item.wiki);
    const foodImages = images.filter(isFoodImage);

    // Sort: prefer raw-related titles
    foodImages.sort((a, b) => preferRaw(b) - preferRaw(a));

    if (foodImages.length > 0) {
      // Try top 3 candidates
      for (const imgTitle of foodImages.slice(0, 3)) {
        try {
          const info = await getWikiFileUrl(imgTitle);
          await sleep(300);
          if (!info || !info.url || !info.mime?.startsWith('image/')) continue;
          const buf = await downloadFile(info.url);
          if (buf.length < 2000) continue; // skip tiny files
          fs.writeFileSync(dest, buf);
          console.log(`  ✅ ${label} ← Wiki: "${imgTitle}" (${info.width}×${info.height}, ${buf.length} bytes)`);
          ok++;
          downloaded = true;
          break;
        } catch { /* try next */ }
      }
    }

    // Also try the summary thumbnail as fallback
    if (!downloaded) {
      const thumbUrl = await getWikiImage(item.wiki);
      await sleep(300);
      if (thumbUrl) {
        try {
          const buf = await downloadFile(thumbUrl);
          if (buf.length > 2000) {
            fs.writeFileSync(dest, buf);
            console.log(`  ✅ ${label} ← Wiki thumbnail: "${item.wiki}" (${buf.length} bytes)`);
            ok++;
            downloaded = true;
          }
        } catch { /* continue to commons */ }
      }
    }
  } catch (err) {
    console.error(`  [wiki] ${label}: ${err.message}`);
  }

  // ── Strategy 2: Wikimedia Commons fallback ───────────────────────────────
  if (!downloaded) {
    try {
      await sleep(1000);
      const titles = await commonsSearch(item.commons);
      await sleep(1000);
      const infos = await commonsInfo(titles.slice(0, 8));
      const usable = infos.filter((ii) =>
        ii.thumburl && ['image/jpeg', 'image/png', 'image/webp'].includes(ii.mime) && ii.size > 5000
      );

      if (usable.length > 0) {
        const pick = usable[0];
        const buf = await downloadFile(pick.thumburl);
        fs.writeFileSync(dest, buf);
        console.log(`  ✅ ${label} ← Commons: "${pick.title}" (${pick.width}×${pick.height}, ${buf.length} bytes)`);
        ok++;
        downloaded = true;
      }
    } catch (err) {
      console.error(`  [commons] ${label}: ${err.message}`);
    }
  }

  if (!downloaded) {
    fs.writeFileSync(dest, placeholder(item.slug));
    console.log(`  ❌ ${label} — no image found`);
    fail++;
  }

  await sleep(500);
}

console.log(`\n[raw-images] DONE — ✅ ${ok} downloaded, ❌ ${fail} failed`);
