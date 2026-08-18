-- Product display ordering within categories (Egyptian-priority menu order)
ALTER TABLE products ADD COLUMN "sortOrder" integer NOT NULL DEFAULT 0;
CREATE INDEX products_category_sort_idx ON products ("categoryId", "sortOrder");