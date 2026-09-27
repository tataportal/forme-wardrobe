-- Nullable for existing garments. Measurements are tied to their cutout keys;
-- renaming a garment must not invalidate or recalculate its anatomy.
ALTER TABLE garments ADD COLUMN layout_json text;
