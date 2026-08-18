-- 007_category_display_order.sql
-- Establish the DEFAULT display order for the seeded menu sections (Egyptian
-- menu priority: pizzas first, then crepes and savories, sweets last).
-- This runs exactly once on existing databases; the admin can reorder
-- categories afterwards from the dashboard (the frontend always renders in
-- categories."sortOrder" order).
UPDATE categories c
   SET "sortOrder" = v."sortOrder"
  FROM (VALUES
    ('بيتزا شرقي',   0),
    ('بيتزا إيطالي', 1),
    ('كريب',         2),
    ('المقبلات',     3),
    ('باستا',        4),
    ('حواوشي',       5),
    ('طواجن وسفرة',  6),
    ('كريب حلو',     7),
    ('حلو',          8)
  ) AS v(name, "sortOrder")
 WHERE c.name = v.name;
