-- 011_fix_blog_image_paths.sql
-- Blog posts reference images that don't exist in public/images/blog/.
-- Update to use the actual available files.

UPDATE posts SET image = '/images/blog/dough.jpg'
  WHERE slug = 'choosing-fresh-meat'
    AND (image = '/images/blog/meat-quality.jpg' OR image IS NULL OR image = '');

UPDATE posts SET image = '/images/blog/feteer.jpg'
  WHERE slug = 'home-hawawshi-guide'
    AND (image = '/images/blog/hawawshi.jpg' OR image IS NULL OR image = '');
