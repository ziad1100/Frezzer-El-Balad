-- 007_category_display_order.sql
-- Establish the DEFAULT display order for the seeded menu sections.
-- This runs exactly once on existing databases; the admin can reorder
-- categories afterwards from the dashboard (the frontend always renders in
-- categories."sortOrder" order).
UPDATE categories c
   SET "sortOrder" = v."sortOrder"
  FROM (VALUES
    ('اللحوم',          0),
    ('الكبدة',          1),
    ('السجق والمصنعات', 2),
    ('البرجر والكفتة',  3),
    ('الفراخ',          4),
    ('منتجات الفراخ الجاهزة', 5),
    ('الحواوشي',        6)
  ) AS v(name, "sortOrder")
 WHERE c.name = v.name;
