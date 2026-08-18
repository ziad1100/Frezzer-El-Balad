#!/usr/bin/env node
/**
 * Import products from menu_meat_items.json into the Freezer El Balad database.
 * 
 * Reads the JSON file, matches products by name, and updates:
 * - basePrice
 * - product_sizes (single size matching the JSON unit)
 * - images (links to /images/products/<slug>.jpg if file exists)
 * 
 * Safe to run multiple times (idempotent — updates existing products, never creates duplicates).
 * 
 * Usage:
 *   node scripts/import-menu-items.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const JSON_PATH = resolve(ROOT, 'menu_meat_items.json');
const PRODUCTS_DIR = join(ROOT, 'public', 'images', 'products');

// Database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[import] DATABASE_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

// Image mapping: product Arabic name → expected image filename (without extension)
const IMAGE_MAP = {
  'لحمة فلانك': 'flank-meat-fresh-meat',
  'لحمة استيك': 'steak-meat-fresh-meat',
  'كبدة بقري': 'beef-liver-liver',
  'كبدة أمريكاني': 'american-liver-liver',
  'سجق شرقي': 'eastern-sausage-sausage-sosis',
  'جلاش': 'goulash-other-products',
  'سوسيس': 'sosis-sausage-sosis',
  'ريش': 'wings-frozen-chicken',
  'برجر بلدي': 'baladi-burger-burger-kofta',
  'برجر': 'burger-burger-kofta',
  'لحمة مفرومة': 'minced-meat-fresh-meat',
  'استربس': 'strips-burger-kofta',
  'شيش': 'shish-frozen-chicken',
  'بانيه': 'pane-pane-strips',
  'بانيه موزاريلا': 'mozzarella-pane-pane-strips',
  'دبوس بلدي': 'baladi-kebab-other-products',
  'كفتة': 'kofta-burger-kofta',
  'حواوشي': 'hawawshi-hawawshi',
  'حواوشي فراخ': 'chicken-hawawshi-hawawshi',
  'حواوشي أرز': 'rice-hawawshi-hawawshi',
  'حواوشي بلدي': 'baladi-hawawshi-hawawshi',
};

const loadJson = () => {
  const raw = readFileSync(JSON_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.items)) {
    throw new Error('menu_meat_items.json must have an "items" array');
  }
  console.log(`[import] loaded ${data.items.length} items from ${JSON_PATH}`);
  console.log(`[import] menu_category: ${data.menu_category}`);
  console.log(`[import] currency: ${data.currency}`);
  return data.items;
};

const resolveImage = (nameAr) => {
  const slug = IMAGE_MAP[nameAr];
  if (!slug) return null;
  const filePath = join(PRODUCTS_DIR, `${slug}.jpg`);
  if (existsSync(filePath)) {
    return `/images/products/${slug}.jpg`;
  }
  return null;
};

const updateProduct = async (client, item) => {
  const nameAr = item.name_ar;
  const nameEn = item.name_en;
  const price = item.price_egp;
  const unit = item.unit;

  // Find existing product by Arabic name
  const result = await client.query(
    'SELECT id, name, "nameEn", "basePrice", images FROM products WHERE name = $1 LIMIT 1',
    [nameAr]
  );

  if (result.rows.length === 0) {
    console.warn(`[import] WARNING: product "${nameAr}" (${nameEn}) not found in DB — skipping`);
    return { found: false, name: nameAr };
  }

  const product = result.rows[0];

  // Resolve image
  const imageUrl = resolveImage(nameAr);
  const hasImage = product.images && product.images.length > 0;
  const needsImage = imageUrl && !hasImage;

  // Update basePrice and images
  if (needsImage) {
    await client.query(
      'UPDATE products SET "basePrice" = $1, images = $2 WHERE id = $3',
      [price, [imageUrl], product.id]
    );
  } else {
    await client.query(
      'UPDATE products SET "basePrice" = $1 WHERE id = $2',
      [price, product.id]
    );
  }

  // Delete existing sizes and recreate with JSON price
  await client.query(
    'DELETE FROM product_sizes WHERE "productId" = $1',
    [product.id]
  );

  // Determine English size name from unit
  const sizeNameEn = unit.includes('كيلو') ? '1kg' :
                     unit.includes('سيخ') ? 'Per Skewer' :
                     unit.includes('قطعة') ? 'Per Piece' :
                     'Regular';

  await client.query(
    `INSERT INTO product_sizes ("productId", "sortOrder", name, "nameEn", price, "isAvailable")
     VALUES ($1, 0, $2, $3, $4, true)`,
    [product.id, unit, sizeNameEn, price]
  );

  return {
    found: true,
    name: nameAr,
    nameEn,
    oldPrice: product.basePrice,
    newPrice: price,
    imageLinked: needsImage,
    imageAlreadyLinked: hasImage,
  };
};

const run = async () => {
  const items = loadJson();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let updated = 0;
    let skipped = 0;
    let imagesLinked = 0;

    for (const item of items) {
      const result = await updateProduct(client, item);
      if (result.found) {
        updated++;
        const changed = result.oldPrice !== result.newPrice;
        const imgTag = result.imageLinked ? ' 🖼️ IMAGE' : result.imageAlreadyLinked ? '' : ' ⚠️ no image';
        const marker = changed ? ' ✓ UPDATED' : ' (unchanged)';
        console.log(`  [${result.name}] ${result.nameEn}: ${result.oldPrice} → ${result.newPrice} EGP${marker}${imgTag}`);
        if (result.imageLinked) imagesLinked++;
      } else {
        skipped++;
      }
    }

    await client.query('COMMIT');
    console.log(`\n[import] DONE: ${updated} products updated, ${imagesLinked} images linked, ${skipped} skipped`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[import] FAILED — rolled back', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
