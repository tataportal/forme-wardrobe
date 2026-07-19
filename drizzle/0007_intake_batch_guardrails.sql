CREATE TABLE `intake_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`expected_count` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_batches_owner_client_unique` ON `intake_batches` (`owner_id`,`client_id`);
--> statement-breakpoint
CREATE INDEX `intake_batches_owner_status_idx` ON `intake_batches` (`owner_id`,`status`);
--> statement-breakpoint
CREATE TABLE `intake_batch_items` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`client_item_id` text NOT NULL,
	`original_filename` text NOT NULL,
	`source_fingerprint` text NOT NULL,
	`garment_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `intake_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`garment_id`) REFERENCES `garments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_batch_items_batch_client_unique` ON `intake_batch_items` (`batch_id`,`client_item_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `intake_batch_items_batch_fingerprint_unique` ON `intake_batch_items` (`batch_id`,`source_fingerprint`);
--> statement-breakpoint
CREATE INDEX `intake_batch_items_batch_status_idx` ON `intake_batch_items` (`batch_id`,`status`);
--> statement-breakpoint
CREATE INDEX `intake_batch_items_garment_idx` ON `intake_batch_items` (`garment_id`);
