-- 009_backfill_images_offers_gallery.sql
-- Backfill missing product images, offer-product relationships, and gallery images.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Backfill product images
--    Products that were seeded with empty images[] because the
--    imageFor() path resolution failed during the initial seed.
-- ─────────────────────────────────────────────────────────────────────
UPDATE products SET images = '{/images/products/pane-pane-strips.jpg}'
  WHERE "nameEn" = 'Pane' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/burger-burger-kofta.jpg}'
  WHERE "nameEn" = 'Burger' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/eastern-sausage-sausage-sosis.jpg}'
  WHERE "nameEn" = 'Eastern Sausage' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/mozzarella-pane-pane-strips.jpg}'
  WHERE "nameEn" = 'Mozzarella Pane' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/baladi-burger-burger-kofta.jpg}'
  WHERE "nameEn" = 'Baladi Burger' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/sosis-sausage-sosis.jpg}'
  WHERE "nameEn" = 'Sosis' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/kofta-burger-kofta.jpg}'
  WHERE "nameEn" = 'Kofta' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);

UPDATE products SET images = '{/images/products/strips-burger-kofta.jpg}'
  WHERE "nameEn" = 'Strips' AND (images IS NULL OR images = '{}'::text[] OR array_length(images, 1) = 0);


-- ─────────────────────────────────────────────────────────────────────
-- 2. Backfill offer-product links
--    The initial seed used hardcoded slug lookups that didn't match
--    the actual generated product slugs, so offer_products was empty.
-- ─────────────────────────────────────────────────────────────────────

-- Offer: "عرض الأسبوع" / Weekly Special (fixed 50 EGP off)
INSERT INTO offer_products ("offerId", "productId")
  SELECT o.id, p.id
  FROM offers o, products p
  WHERE o."titleEn" = 'Weekly Special'
    AND p."nameEn" IN ('Steak Meat', 'Flank Meat', 'Minced Meat', 'Kofta', 'Hawawshi')
  ON CONFLICT DO NOTHING;

-- Offer: "عروض الفراخ" / Chicken Deals (15% off)
INSERT INTO offer_products ("offerId", "productId")
  SELECT o.id, p.id
  FROM offers o, products p
  WHERE o."titleEn" = 'Chicken Deals'
    AND p."nameEn" IN ('Wings', 'Shish', 'Pane', 'Mozzarella Pane', 'Chicken Hawawshi')
  ON CONFLICT DO NOTHING;

-- Offer: "عرض العائلة" / Family Deal (fixed 40 EGP off)
INSERT INTO offer_products ("offerId", "productId")
  SELECT o.id, p.id
  FROM offers o, products p
  WHERE o."titleEn" = 'Family Deal'
    AND p."nameEn" IN ('Hawawshi', 'Chicken Hawawshi', 'Baladi Hawawshi', 'Burger', 'Baladi Burger')
  ON CONFLICT DO NOTHING;

-- Backfill offer banners from the first linked product image
UPDATE offers o
   SET banner = sub.url
  FROM (
    SELECT op."offerId", p.images[1] AS url
      FROM offer_products op
      JOIN products p ON p.id = op."productId"
     WHERE p.images IS NOT NULL
       AND array_length(p.images, 1) > 0
       AND p.images[1] <> ''
  ) sub
 WHERE sub."offerId" = o.id
   AND (o.banner IS NULL OR o.banner = '');

-- ─────────────────────────────────────────────────────────────────────
-- 3. Backfill gallery images
--    galleryImagesSeed was empty, so no gallery images were created.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO gallery_images (title, "titleEn", image, "sortOrder", "isVisible")
SELECT v.title, v."titleEn", v.image, v."sortOrder", true
  FROM (VALUES
    ('لحمة فلانك', 'Flank Meat', '/images/products/flank-meat-fresh-meat.jpg', 0),
    ('لحمة استيك', 'Steak Meat', '/images/products/steak-meat-fresh-meat.jpg', 1),
    ('لحمة مفرومة', 'Minced Meat', '/images/products/minced-meat-fresh-meat.jpg', 2),
    ('كبدة بقري', 'Beef Liver', '/images/products/beef-liver-liver.jpg', 3),
    ('كبدة أمريكاني', 'American Liver', '/images/products/american-liver-liver.jpg', 4),
    ('سجق شرقي', 'Eastern Sausage', '/images/products/eastern-sausage-sausage-sosis.jpg', 5),
    ('سوسيس', 'Sosis', '/images/products/sosis-sausage-sosis.jpg', 6),
    ('جلاش', 'Goulash', '/images/products/goulash-other-products.jpg', 7),
    ('برجر', 'Burger', '/images/products/burger-burger-kofta.jpg', 8),
    ('برجر بلدي', 'Baladi Burger', '/images/products/baladi-burger-burger-kofta.jpg', 9),
    ('كفتة', 'Kofta', '/images/products/kofta-burger-kofta.jpg', 10),
    ('استربس', 'Strips', '/images/products/strips-burger-kofta.jpg', 11),
    ('ريش', 'Wings', '/images/products/wings-frozen-chicken.jpg', 12),
    ('شيش', 'Shish', '/images/products/shish-frozen-chicken.jpg', 13),
    ('بانيه', 'Pane', '/images/products/pane-pane-strips.jpg', 14),
    ('بانيه موزاريلا', 'Mozzarella Pane', '/images/products/mozzarella-pane-pane-strips.jpg', 15),
    ('حواوشي', 'Hawawshi', '/images/products/hawawshi-hawawshi.jpg', 16),
    ('حواوشي فراخ', 'Chicken Hawawshi', '/images/products/chicken-hawawshi-hawawshi.jpg', 17),
    ('حواوشي أرز', 'Rice Hawawshi', '/images/products/rice-hawawshi-hawawshi.jpg', 18),
    ('حواوشي بلدي', 'Baladi Hawawshi', '/images/products/baladi-hawawshi-hawawshi.jpg', 19)
  ) AS v(title, "titleEn", image, "sortOrder")
WHERE NOT EXISTS (SELECT 1 FROM gallery_images g WHERE g.image = v.image);
