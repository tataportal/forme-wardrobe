CREATE TABLE `billing_accounts` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`plan_id` text DEFAULT 'trial' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`billing_cycle` text,
	`provider` text,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`current_period_start` text,
	`current_period_end` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_provider_customer_unique` ON `billing_accounts` (`provider`,`provider_customer_id`);
--> statement-breakpoint
CREATE TABLE `digitization_credit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`garment_id` text,
	`event_type` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`garment_id`) REFERENCES `garments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `digitization_credit_idempotency_unique` ON `digitization_credit_events` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `digitization_credit_owner_idx` ON `digitization_credit_events` (`owner_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `ai_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`garment_id` text,
	`job_id` text,
	`operation` text NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`model` text NOT NULL,
	`request_id` text,
	`input_tokens` integer,
	`cached_input_tokens` integer,
	`image_input_tokens` integer,
	`text_input_tokens` integer,
	`output_tokens` integer,
	`cost_microusd` integer,
	`attempt` integer DEFAULT 1 NOT NULL,
	`metadata_json` text,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`garment_id`) REFERENCES `garments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`job_id`) REFERENCES `processing_jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_usage_idempotency_unique` ON `ai_usage_events` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `ai_usage_owner_idx` ON `ai_usage_events` (`owner_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ai_usage_job_idx` ON `ai_usage_events` (`job_id`);
--> statement-breakpoint
CREATE TABLE `sales_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`plan_id` text NOT NULL,
	`billing_cycle` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`source` text DEFAULT 'pricing' NOT NULL,
	`dedupe_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_leads_dedupe_unique` ON `sales_leads` (`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `sales_leads_status_idx` ON `sales_leads` (`status`,`created_at`);
