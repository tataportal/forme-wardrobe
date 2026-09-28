CREATE TABLE `referral_codes` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_code_unique` ON `referral_codes` (`code`);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`referrer_owner_id` text NOT NULL,
	`referred_owner_id` text NOT NULL,
	`code` text NOT NULL,
	`reward_amount` integer DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`referrer_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referred_owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_referred_unique` ON `referrals` (`referred_owner_id`);
--> statement-breakpoint
CREATE INDEX `referrals_referrer_idx` ON `referrals` (`referrer_owner_id`,`created_at`);
