#!/usr/bin/env node
// Product image audit — flags products with missing/broken/duplicated/suspicious images
// plus a gallery check (src/lib/gallery.ts). Run with tsx so the .ts gallery module loads:
//
//   cd server && DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" \
//     npx tsx ../scripts/audit-product-images.mjs --db   (checks the live DB)
//   npx tsx scripts/audit-product-images.mjs             (checks the seed catalog)
//
// Statuses: OK | MISSING-FILE | EXTERNAL | SHARED (with other products) | SUSPICIOUS.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_DIR = path.join(ROOT, 'public', 'images', 'products');

const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const loadFromSeed = async () => {
  const { seedSections } = await import('../server/src/database/seedData.ts');
  const rows = [];
  for (const section of seedSections) {
    for (const sub of section.subs) {
      for (const item of sub.items) {
        rows.push({
          _id: item.ar,
          name: item.ar,
          nameEn: item.en,
          category: `${section.en} / ${sub.en}`,
          images: [item.image ?? `/images/products/${slug(item.en)}-${slug(sub.en)}.jpg`],
        });
      }
    }
  }
  return rows;
};

const loadFromDb = async () => {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    `SELECT p.id::text AS _id, p.name, p."nameEn", p.images,
            CASE WHEN c.id IS NULL THEN '' ELSE c."nameEn" || ' / ' || COALESCE(c2."nameEn", '') END AS category
     FROM products p
     LEFT JOIN categories c ON c.id = p."categoryId"
     LEFT JOIN categories c2 ON c2.id = c."parentId"
     ORDER BY p."sortOrder", p."createdAt"`,
  );
  await pool.end();
  return r.rows;
};

const audit = async () => {
  const useDb = process.argv.includes('--db');
  const rows = useDb ? await loadFromDb() : await loadFromSeed();

  const byImage = new Map();
  for (const row of rows) {
    const url = row.images?.[0] ?? '';
    if (!byImage.has(url)) byImage.set(url, []);
    byImage.get(url).push(row);
  }

  const report = { ok: [], missing: [], external: [], shared: [], suspicious: [], rows: [] };
  const fileCache = new Map();
  const exists = (file) => {
    if (!fileCache.has(file)) fileCache.set(file, fs.existsSync(path.join(PRODUCTS_DIR, file)));
    return fileCache.get(file);
  };

  for (const row of rows) {
    const url = row.images?.[0] ?? '';
    const statuses = [];

    if (!url) {
      statuses.push('MISSING-FILE (no image)');
    } else if (/^https?:\/\//.test(url)) {
      statuses.push('EXTERNAL');
      report.external.push(row);
    } else {
      const file = path.basename(new URL(url, 'http://x').pathname);
      if (!exists(file)) statuses.push(`MISSING-FILE (${file})`);
      else if (file.endsWith('.svg')) statuses.push('PLACEHOLDER-SVG');
      else if (!/\.(jpe?g|png|webp|avif|gif)$/i.test(file)) statuses.push(`ODD-FORMAT (${file})`);
    }

    if (byImage.get(url).length > 1) {
      statuses.push(`SHARED (with ${byImage.get(url).length - 1} other product(s))`);
    }

    const nameWords = slug(row.nameEn ?? row.name).split('-').filter((w) => w.length > 3);
    const fileBase = slug(path.basename(url.replace(/\.\w+$/, '')));
    const sharedWords = nameWords.filter((w) => fileBase.includes(w));
    if (url && nameWords.length > 0 && sharedWords.length === 0) {
      statuses.push(`SUSPICIOUS (no name overlap with file "${path.basename(url)}")`);
    }

    report.rows.push({ ...row, url, statuses });
    if (statuses.some((s) => s.startsWith('MISSING') || s === 'PLACEHOLDER-SVG')) report.missing.push(row);
    else if (statuses.some((s) => s.startsWith('SHARED'))) report.shared.push(row);
    else if (statuses.some((s) => s.startsWith('SUSPICIOUS'))) report.suspicious.push(row);
    else report.ok.push(row);
  }

  console.log(`\n=== PRODUCT IMAGE AUDIT (${useDb ? 'LIVE DB' : 'SEED'}): ${rows.length} products ===`);
  console.log(`OK: ${report.ok.length} | MISSING/PLACEHOLDER: ${report.missing.length} | SHARED: ${report.shared.length} | SUSPICIOUS: ${report.suspicious.length} | EXTERNAL: ${report.external.length}`);

  const dump = (label, list) => {
    if (!list.length) return;
    console.log(`\n--- ${label} (${list.length}) ---`);
    for (const r of list) {
      const file = r.url ? path.basename(r.url) : r.images?.[0] ? path.basename(r.images[0]) : '(none)';
      console.log(`  ${r.category ? `[${r.category}] ` : ''}${r.nameEn ?? r.name} (${r.name}) -> ${file}`);
    }
  };
  dump('MISSING / PLACEHOLDER', report.missing);
  dump('SHARED IMAGES', report.shared);
  dump('SUSPICIOUS MAPPINGS', report.suspicious);
  dump('EXTERNAL URLs', report.external);

  console.log('\n--- SHARED GROUPS (image -> products) ---');
  for (const [url, group] of byImage) {
    if (group.length < 2) continue;
    const file = path.basename(url);
    const names = [...new Set(group.map((r) => r.nameEn ?? r.name))];
    const sameFlavor = names.length === 1;
    console.log(`  ${sameFlavor ? 'SAME-FLAVOR' : 'MIXED-FLAVOR!'} ${file}: ${group.map((r) => r.nameEn ?? r.name).join(' | ')}`);
  }
};

// --- gallery audit (seed list + live gallery_images table when --db) ---
const galleryAudit = async (useDb) => {
  const problems = [];
  const seenSrc = new Set();
  const seenLabel = new Set();
  const checkFile = (url, label) => {
    if (seenSrc.has(url)) problems.push(`duplicate src: ${url}`);
    if (seenLabel.has(label)) problems.push(`duplicate label: ${label}`);
    seenSrc.add(url);
    seenLabel.add(label);
    const file = path.basename(new URL(url, 'http://x').pathname);
    if (!fs.existsSync(path.join(PRODUCTS_DIR, file))) problems.push(`missing file: ${label} -> ${url}`);
  };

  let total = 0;
  let hidden = 0;
  if (useDb) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const r = await pool.query(
      `SELECT g.title, g."titleEn", g.image, g."isVisible" FROM gallery_images g ORDER BY g."sortOrder", g.id`,
    );
    await pool.end();
    total = r.rows.length;
    for (const row of r.rows) {
      if (!row.isVisible) hidden += 1;
      checkFile(row.image, row.title);
    }
    console.log(`\n=== GALLERY AUDIT (LIVE DB): ${total} images (${hidden} hidden) ===`);
  } else {
    const { galleryItems } = await import('../src/lib/gallery.ts');
    total = galleryItems.length;
    for (const g of galleryItems) checkFile(g.src, g.label);
    console.log(`\n=== GALLERY AUDIT (SEED LIST): ${total} items ===`);
  }
  console.log(problems.length ? problems.map((p) => `  ! ${p}`).join('\n') : '  all images exist, no duplicate srcs/labels ✓');
};

const run = async () => {
  const useDb = process.argv.includes('--db');
  await audit();
  await galleryAudit(useDb);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
