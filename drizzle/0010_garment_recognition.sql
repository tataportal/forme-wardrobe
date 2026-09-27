ALTER TABLE garments ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE garments ADD COLUMN recognition_status text NOT NULL DEFAULT 'legacy';
ALTER TABLE garments ADD COLUMN recognition_json text;
ALTER TABLE garments ADD COLUMN metadata_status text NOT NULL DEFAULT 'ready';
ALTER TABLE garments ADD COLUMN metadata_revision integer NOT NULL DEFAULT 0;
ALTER TABLE processing_jobs ADD COLUMN stage text NOT NULL DEFAULT 'generate';
ALTER TABLE processing_jobs ADD COLUMN generated_key text;
