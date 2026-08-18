#!/usr/bin/env node
// Curated dish-photo provisioning via Wikimedia Commons.
//
// Openverse keyword search produced the mismatched photos in the catalog
// (e.g. "Jumbo Can" -> electronics). Commons filenames describe content
// accurately ("Nutella & banana crêpe - Oui Crêperie.jpg"), so we use them.
//
// Modes:
//   fetch  - download top candidates per item into scripts/photo-candidates,
//            emit manifest.json + review.html (contact sheet for human review).
//   apply  - copy approved candidates over public/images/products/<file> and
//            update scripts/menu-photo-map.json rows for the curated items.
//
// Approvals live in scripts/photo-candidates/approvals.json:
//   { "<target-file>": <candidate-index> | -1 (keep current) }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'images', 'products');
const CAND_DIR = path.join(ROOT, 'scripts', 'photo-candidates');
const MANIFEST = path.join(CAND_DIR, 'manifest.json');
const APPROVALS = path.join(CAND_DIR, 'approvals.json');
const CONTACT_SHEET = path.join(CAND_DIR, 'review.html');
const MAP_JSON = path.join(ROOT, 'scripts', 'menu-photo-map.json');

const UA = 'orabi-menu-tool/1.0 (menu rework)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

// target file -> { q: primary query, fb: fallback query }
const CURATED = {
  'baked-rice-dessert.jpg': { q: 'rice pudding', fb: 'milk rice dessert' },
  'regular-rice-dessert.jpg': { q: 'white rice bowl', fb: 'cooked rice plate' },
  'regular-can-delivery-cans.jpg': { q: 'takeaway food box', fb: 'kraft food container' },
  'super-can-delivery-cans.jpg': { q: 'biryani foil', fb: 'biryani tray' },
  'jumbo-can-delivery-cans.jpg': { q: 'foil tray food', fb: 'large takeaway container' },
  'water-dessert.jpg': { q: 'plastic water bottle', fb: 'transparent water bottle' },
  'lotus-sweet-feteer.jpg': { q: 'lotus biscoff crepe', fb: 'biscoff dessert crepe' },
  'chocolate-banana-sweet-feteer.jpg': { q: 'chocolate banana crepe', fb: 'banana nutella crepe' },
  'chocolate-oreo-sweet-feteer.jpg': { q: 'oreo crepe', fb: 'chocolate cookie crepe' },
  'chocolate-sweet-feteer.jpg': { q: 'chocolate crepe', fb: 'nutella crepe' },
  'roumy-cheese-cheese.jpg': { q: 'cheese crepe', fb: 'cheese galette' },
  'mozzarella-crepe-assorted-crepe.jpg': { q: 'mozzarella crepe', fb: 'cheese crepe' },
  'mushroom-crepe-assorted-crepe.jpg': { q: 'mushroom crepe', fb: 'mushroom galette' },
  'potato-crepe-assorted-crepe.jpg': { q: 'potato crepe', fb: 'potato galette' },
  'cheddar-potato-appetizers.jpg': { q: 'loaded cheese fries', fb: 'cheese fries' },
  'baked-mozzarella-potato-appetizers.jpg': { q: 'baked potato cheese', fb: 'cheesy baked potato' },
  'meat-pasta-pasta.jpg': { q: 'bolognese pasta', fb: 'spaghetti bolognese' },
  'alfredo-pasta-pasta.jpg': { q: 'fettuccine alfredo', fb: 'creamy white sauce pasta' },
'kiri-cheese-cheese.jpg': { q: 'kiri cheese', fb: 'cream cheese portions' },
  'bbq-chicken-crepe-chicken-crepe.jpg': { q: 'chicken crepe', fb: 'chicken wrap' },
  'sausage-hawawshi-hawawshi.jpg': { q: 'sausage sandwich', fb: 'sujuk sausage' },
  'meat-hawawshi-hawawshi.jpg': { q: 'pide meat', fb: 'kibbeh' },
  'chicken-hawawshi-hawawshi.jpg': { q: 'chicken shawarma sandwich', fb: 'gyro wrap' },
  'tuna-hawawshi-hawawshi.jpg': { q: 'tuna sandwich toasted', fb: 'tuna pie' },
  'cheese-mix-hawawshi-hawawshi.jpg': { q: 'cheese stuffed bread', fb: 'cheese pie pastry' },
  'meat-mix-hawawshi-hawawshi.jpg': { q: 'lahmacun', fb: 'stuffed flatbread' },
  'chicken-mix-hawawshi-hawawshi.jpg': { q: 'chicken wrap', fb: 'shawarma wrap' },
  'beef-meat.jpg': { q: 'raw beef steak', fb: 'beef cut meat' },
  'meat-tagine-tagine.jpg': { q: 'beef tagine', fb: 'moroccan meat tagine' },
  'meat-mix-tagine-tagine.jpg': { q: 'meat tagine', fb: 'grilled meat tagine' },
  'meat-mozzarella-tagine-tagine.jpg': { q: 'karniyarik', fb: 'pastitsio' },
  'meat-crepe-meat-crepe.jpg': { q: 'meat crepe', fb: 'savory crepe meat' },
  'meat-burger-crepe-meat-crepe.jpg': { q: 'burger wrap', fb: 'beef burger' },
  'hot-dog-crepe-meat-crepe.jpg': { q: 'hot dog roll', fb: 'hot dog bread' },
  'mexican-hot-dog-crepe-meat-crepe.jpg': { q: 'mexican hot dog', fb: 'hot dog jalapeno' },
  'baladi-sausage-crepe-meat-crepe.jpg': { q: 'sausage roll', fb: 'grilled sausage wrap' },
  'alexandrian-sausage-crepe-meat-crepe.jpg': { q: 'sausage wrap', fb: 'sausage pastry' },
  'kofta-crepe-meat-crepe.jpg': { q: 'kebab wrap', fb: 'adana kebab' },
  'chicken-fajita-crepe-chicken-crepe.jpg': { q: 'chicken fajita wrap', fb: 'fajita burrito' },
  'chocolate-oreo-sweet-feteer.jpg': { q: 'oreo crepe', fb: 'chocolate cookie crepe' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const download = async (src) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(src, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? '') || 8 + attempt * 8;
      console.warn(`[dl] 429, retrying in ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`download ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error(`not an image: ${type}`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('download rate-limited after 5 attempts');
};

const api = async (params) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const url = `${COMMONS}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? '') || 4 + attempt * 4;
      console.warn(`[api] 429, retrying in ${wait}s...`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Commons ${res.status}`);
    return res.json();
  }
  throw new Error('Commons rate-limited after 5 attempts');
};

const search = async (q) => {
  const body = await api({
    action: 'query', list: 'search', srsearch: q, srnamespace: '6',
    srlimit: '10', format: 'json', origin: '*',
  });
  await sleep(400);
  return (body.query?.search ?? []).map((r) => r.title);
};

const infoBatch = async (titles) => {
  const body = await api({
    action: 'query', titles: titles.join('|'), prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: '900', format: 'json', origin: '*',
  });
  await sleep(400);
  return Object.values(body.query?.pages ?? {})
    .filter((p) => p.imageinfo?.[0])
    .map((p) => ({ title: p.title, ...p.imageinfo[0] }));
};

const ext = (meta) => meta?.extmetadata ?? {};
const plain = (x) => x?.value ?? '';

const score = (title, item) => {
  const t = title.toLowerCase();
  const words = item.q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return words.reduce((s, w) => s + (t.includes(w) ? 2 : 0), 0);
};

async function fetchMode(args) {
  if (!fs.existsSync(CAND_DIR)) fs.mkdirSync(CAND_DIR, { recursive: true });
  const manifest = JSON.parse(fs.existsSync(MANIFEST) ? fs.readFileSync(MANIFEST, 'utf8') : '[]');
  const targets = args.length ? Object.fromEntries(args.map((f) => [f, CURATED[f]])) : CURATED;
  for (const [file, cfg] of Object.entries(targets)) {
    if (!cfg) { console.warn(`[fetch] unknown target: ${file}`); continue; }
    const dir = path.join(CAND_DIR, path.parse(file).name);
    fs.mkdirSync(dir, { recursive: true });
    const titles = [];
    for (const q of [cfg.q, cfg.fb]) {
      try {
        const found = await search(q);
        titles.push(...found.filter((t) => !titles.includes(t)));
        if (titles.length >= 5) break;
      } catch (err) {
        console.error(`[search] ${file} "${q}": ${err.message}`);
      }
    }
    const item = { file, candidates: [] };
    const infos = await infoBatch(titles.slice(0, 6));
    for (const ii of infos) {
      const title = ii.title ?? '?';
      try {
        if (!ii.thumburl || !['image/jpeg', 'image/png', 'image/webp'].includes(ii.mime)) continue;
        const idx = item.candidates.length;
        const dest = path.join(dir, `${idx}--${title.replace(/^File:/, '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 90)}.jpg`);
        const buf = await download(ii.thumburl);
        fs.writeFileSync(dest, buf);
        const meta = ext(ii);
        item.candidates.push({
          idx, title, file: path.relative(CAND_DIR, dest),
          url: ii.url, width: ii.width, height: ii.height,
          license: plain(meta.LicenseShortName) || plain(meta.License),
          artist: plain(meta.Artist).replace(/<[^>]+>/g, '').slice(0, 80),
          score: score(title, cfg),
        });
        console.log(`  [${file}] ${title} (${ii.width}x${ii.height}, ${item.candidates.length - 1})`);
      } catch (err) {
        console.error(`[info] ${file} ${title}: ${err.message}`);
      }
    }
    const prior = manifest.findIndex((m) => m.file === file);
    if (prior !== -1) manifest.splice(prior, 1);
    manifest.push(item);
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    buildContactSheet(manifest);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  buildContactSheet(manifest);
  console.log(`[fetch] ${Object.keys(targets).length} items, manifest + contact sheet at ${CONTACT_SHEET}`);
}

function buildContactSheet(manifest) {
  const best = manifest
    .filter((m) => m.candidates.length)
    .map((m) => {
      const [top] = [...m.candidates].sort((a, b) => b.score - a.score);
      return [m.file, top.idx];
    });
  const cur = (file) => `../public/images/products/${file}`;
  const rows = manifest.map((m) => {
    const thumbs = m.candidates.map((c) => `
      <div class="cand">
        <input type="checkbox" name="${m.file}" value="${c.idx}" ${best.find(([f]) => f === m.file)?.[1] === c.idx ? 'checked' : ''}>
        <img src="${c.file}" loading="lazy">
        <span>#${c.idx} ${c.title.replace(/^File:/, '').slice(0, 70)}</span>
        <span class="meta">${c.width}x${c.height} ${c.license} ${c.artist}</span>
      </div>`).join('');
    return `<section class="item" id="${m.file}">
      <h3>${m.file}</h3>
      <div class="cands">
        <div class="cand current"><span class="tag">CURRENT</span><img src="${cur(m.file)}" loading="lazy"></div>
        ${thumbs}
      </div>
    </section>`;
  });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Menu photo review</title>
<style>
  body { font-family: Segoe UI, Arial, sans-serif; background: #14141b; color: #e7e7ef; margin: 24px; }
  h1 { font-size: 20px; } h3 { margin: 18px 0 8px; font-size: 14px; color: #f5c04a; }
  .cands { display: flex; gap: 12px; flex-wrap: wrap; }
  .cand { border: 1px solid #2b2b3d; border-radius: 8px; padding: 8px; width: 190px; background: #1d1d28; }
  .cand img { width: 100%; height: 130px; object-fit: cover; border-radius: 4px; }
  .cand span { display: block; font-size: 11px; margin-top: 4px; }
  .cand .meta { color: #8a8aa3; }
  .tag { color: #8a8aa3; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  .current { border-color: #555; opacity: .85; }
</style></head><body>
<h1>Pick one candidate per item (checkbox) - keep CURRENT if none are good</h1>
<button onclick="collect()">Generate approvals JSON</button><pre id="out"></pre>
${rows.join('\n')}
<script>
function collect() {
  const out = {};
  document.querySelectorAll('section.item').forEach((s) => {
    const file = s.id;
    const checked = s.querySelectorAll('input:checked');
    out[file] = checked.length ? Number(checked[0].value) : -1;
  });
  document.getElementById('out').textContent = JSON.stringify(out, null, 2);
}
</script></body></html>`;
  fs.writeFileSync(CONTACT_SHEET, html);
}

function applyMode() {
  if (!fs.existsSync(APPROVALS)) throw new Error(`approvals.json missing at ${APPROVALS}`);
  const approvals = JSON.parse(fs.readFileSync(APPROVALS, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const map = JSON.parse(fs.readFileSync(MAP_JSON, 'utf8'));
  let applied = 0;
  for (const item of manifest) {
    const pick = approvals[item.file];
    if (pick === undefined) { console.warn(`[apply] no approval for ${item.file}`); continue; }
    if (pick === -1) { console.log(`[apply] keep current: ${item.file}`); continue; }
    const cand = item.candidates[pick];
    if (!cand) { console.warn(`[apply] bad index ${pick} for ${item.file}`); continue; }
    const src = path.join(CAND_DIR, cand.file);
    const dest = path.join(PRODUCTS_DIR, item.file);
    fs.copyFileSync(src, dest);
    const row = map.find((r) => r.file === item.file);
    if (row) {
      row.source = 'commons';
      row.photo = item.file;
      row.credit = cand.license;
      row.attribution = cand.artist;
      row.sourceUrl = cand.url;
    }
    applied += 1;
    console.log(`[apply] ${item.file} <- ${cand.title}`);
  }
  fs.writeFileSync(MAP_JSON, JSON.stringify(map, null, 2));
  console.log(`[apply] DONE: ${applied}/${Object.keys(approvals).length} applied, map updated`);
}

async function repairMode() {
  if (!fs.existsSync(APPROVALS)) throw new Error(`approvals.json missing at ${APPROVALS}`);
  const approvals = JSON.parse(fs.readFileSync(APPROVALS, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const picks = manifest.map((m) => {
    const idx = approvals[m.file];
    const cand = idx !== undefined && idx !== -1 ? m.candidates[idx] : null;
    return { item: m, pick: cand };
  }).filter((p) => p.pick);
  console.log(`[repair] re-downloading ${picks.length} approved images...`);
  for (const { item, pick } of picks) {
    const [ii] = await infoBatch([pick.title]);
    if (!ii?.thumburl) { console.warn(`[repair] no thumb for ${item.file}`); continue; }
    try {
      const buf = await download(ii.thumburl);
      if (!(buf[0] === 0xff && buf[1] === 0xd8)) throw new Error('not a JPEG');
      const candPath = path.join(CAND_DIR, pick.file);
      const prodPath = path.join(PRODUCTS_DIR, item.file);
      fs.writeFileSync(candPath, buf);
      fs.writeFileSync(prodPath, buf);
      const meta = ext(ii);
      pick.width = ii.width; pick.height = ii.height;
      pick.url = ii.url;
      pick.license = plain(meta.LicenseShortName) || plain(meta.License);
      pick.artist = plain(meta.Artist).replace(/<[^>]+>/g, '').slice(0, 80);
      console.log(`[repair] OK ${item.file} <- ${pick.title} (${buf.length} bytes)`);
    } catch (err) {
      console.error(`[repair] FAILED ${item.file}: ${err.message}`);
    }
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}

const mode = process.argv[2] ?? 'fetch';
if (mode === 'fetch') await fetchMode(process.argv.slice(3));
else if (mode === 'apply') applyMode();
else if (mode === 'repair') await repairMode();
else throw new Error(`unknown mode: ${mode} (use fetch | apply | repair)`);
