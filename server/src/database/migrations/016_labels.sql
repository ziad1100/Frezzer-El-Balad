-- Labels table for flexible product classification
CREATE TABLE IF NOT EXISTS labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "nameEn" text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#38BDF8',
  icon text NOT NULL DEFAULT '',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE INDEX labels_active_idx ON labels ("isActive");

-- Junction table: products ↔ labels (many-to-many)
CREATE TABLE IF NOT EXISTS product_labels (
  "productId" uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "labelId" uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("productId", "labelId")
);

CREATE INDEX product_labels_product_idx ON product_labels ("productId");
CREATE INDEX product_labels_label_idx ON product_labels ("labelId");
