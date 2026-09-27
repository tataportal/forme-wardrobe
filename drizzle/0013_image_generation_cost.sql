ALTER TABLE `processing_jobs` ADD `image_model` text;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `image_input_tokens` integer;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `text_input_tokens` integer;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `image_output_tokens` integer;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD `generation_cost_microusd` integer;
