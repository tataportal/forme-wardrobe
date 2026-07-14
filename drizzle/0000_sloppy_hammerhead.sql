CREATE TABLE `garment_tags` (
	`garment_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`garment_id`, `tag`),
	FOREIGN KEY (`garment_id`) REFERENCES `garments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `garment_tags_tag_idx` ON `garment_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `garments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`color_family` text NOT NULL,
	`tone` text NOT NULL,
	`material` text NOT NULL,
	`finish` text NOT NULL,
	`silhouette` text NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`source_image_key` text,
	`generated_image_key` text,
	`image_key` text,
	`open_image_key` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `garments_owner_idx` ON `garments` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `garments_owner_client_unique` ON `garments` (`owner_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `garments_owner_category_idx` ON `garments` (`owner_id`,`category`);--> statement-breakpoint
CREATE INDEX `garments_owner_status_idx` ON `garments` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `outfit_items` (
	`id` text PRIMARY KEY NOT NULL,
	`outfit_id` text NOT NULL,
	`garment_client_id` text NOT NULL,
	`variant` text DEFAULT 'closed' NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`scale` integer NOT NULL,
	`rotation` integer DEFAULT 0 NOT NULL,
	`z` integer NOT NULL,
	FOREIGN KEY (`outfit_id`) REFERENCES `outfits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `outfit_items_outfit_idx` ON `outfit_items` (`outfit_id`);--> statement-breakpoint
CREATE INDEX `outfit_items_garment_idx` ON `outfit_items` (`garment_client_id`);--> statement-breakpoint
CREATE TABLE `outfits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text DEFAULT 'Conjunto sin nombre' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `outfits_owner_idx` ON `outfits` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `outfits_owner_client_unique` ON `outfits` (`owner_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`garment_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`type` text DEFAULT 'ghost_mannequin' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider` text DEFAULT 'openai+cloudflare' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`garment_id`) REFERENCES `garments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `processing_jobs_owner_idx` ON `processing_jobs` (`owner_id`);--> statement-breakpoint
CREATE INDEX `processing_jobs_garment_idx` ON `processing_jobs` (`garment_id`);--> statement-breakpoint
CREATE INDEX `processing_jobs_status_idx` ON `processing_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);