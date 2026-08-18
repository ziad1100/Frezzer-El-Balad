-- 005_gallery_images.sql — admin-managed food gallery
-- Public page reads visible rows only; admins CRUD through the /gallery API.
CREATE TABLE gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  "titleEn" text NOT NULL DEFAULT '',
  image text NOT NULL UNIQUE,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isVisible" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gallery_images_visible_sort_idx ON gallery_images ("isVisible", "sortOrder", id);

CREATE TRIGGER gallery_images_updated_at BEFORE UPDATE ON gallery_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_gallery_read ON gallery_images FOR SELECT TO anon, authenticated USING ("isVisible" = true);
GRANT SELECT ON gallery_images TO anon, authenticated;
