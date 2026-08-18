-- 006_quick_reviews.sql — inline meal-card quick reviews
-- Quick reviews are meal reviews without an order (orderId NULL): a logged-in
-- customer can rate any meal directly from the menu. The partial unique index
-- keeps it to ONE quick review per user + meal, while order-linked reviews
-- (orderId NOT NULL) stay governed by the existing per-order unique index.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product_quick_idx
  ON reviews ("userId", "productId") WHERE "orderId" IS NULL AND "reviewType" = 'meal';
