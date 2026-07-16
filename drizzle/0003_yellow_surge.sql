CREATE TABLE `style_family_ratings` (
	`owner_id` text NOT NULL,
	`family` text NOT NULL,
	`affinity` integer DEFAULT 50 NOT NULL,
	`blocked` integer DEFAULT false NOT NULL,
	`reason` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `family`),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `style_family_ratings_owner_idx` ON `style_family_ratings` (`owner_id`);--> statement-breakpoint
CREATE INDEX `style_family_ratings_affinity_idx` ON `style_family_ratings` (`owner_id`,`affinity`);--> statement-breakpoint
CREATE TABLE `style_profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`audience` text DEFAULT 'hombre' NOT NULL,
	`exploration` integer DEFAULT 35 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
