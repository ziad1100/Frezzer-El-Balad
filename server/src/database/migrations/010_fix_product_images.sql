-- 010_fix_product_images.sql
-- Fix product images that weren't backfilled in migration 009.
-- array_length('{}'::text[], 1) returns NULL, not 0, so the previous
-- condition `array_length(images, 1) = 0` never matched empty arrays.

UPDATE products SET images = '{/images/products/pane-pane-strips.jpg}'
  WHERE "nameEn" = 'Pane' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/burger-burger-kofta.jpg}'
  WHERE "nameEn" = 'Burger' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/eastern-sausage-sausage-sosis.jpg}'
  WHERE "nameEn" = 'Eastern Sausage' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/mozzarella-pane-pane-strips.jpg}'
  WHERE "nameEn" = 'Mozzarella Pane' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/baladi-burger-burger-kofta.jpg}'
  WHERE "nameEn" = 'Baladi Burger' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/sosis-sausage-sosis.jpg}'
  WHERE "nameEn" = 'Sosis' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/kofta-burger-kofta.jpg}'
  WHERE "nameEn" = 'Kofta' AND (images IS NULL OR images = '{}'::text[]);

UPDATE products SET images = '{/images/products/strips-burger-kofta.jpg}'
  WHERE "nameEn" = 'Strips' AND (images IS NULL OR images = '{}'::text[]);
