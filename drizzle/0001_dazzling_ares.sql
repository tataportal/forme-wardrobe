ALTER TABLE `garments` ADD `processing_image_key` text;--> statement-breakpoint
ALTER TABLE `garments` ADD `generated_open_image_key` text;--> statement-breakpoint
ALTER TABLE `garments` ADD `quality` text DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE `garments` ADD `qa_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `garments` ADD `qa_notes` text;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `quality` text DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `presentation` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `output_variant` text DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `mode` text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `batch_id` text;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `openai_file_id` text;--> statement-breakpoint
CREATE INDEX `processing_jobs_batch_idx` ON `processing_jobs` (`batch_id`);