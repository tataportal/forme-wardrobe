ALTER TABLE `garments` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `outfits` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `handle` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `discoverable` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `show_closet` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `show_looks` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);