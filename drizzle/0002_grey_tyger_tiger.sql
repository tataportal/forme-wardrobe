CREATE TABLE `weekly_plan_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_date` text NOT NULL,
	`outfit_client_id` text NOT NULL,
	`occasion` text DEFAULT 'daily' NOT NULL,
	`worn` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_plan_owner_date_unique` ON `weekly_plan_entries` (`owner_id`,`plan_date`);--> statement-breakpoint
CREATE INDEX `weekly_plan_owner_idx` ON `weekly_plan_entries` (`owner_id`);--> statement-breakpoint
CREATE INDEX `weekly_plan_outfit_idx` ON `weekly_plan_entries` (`outfit_client_id`);