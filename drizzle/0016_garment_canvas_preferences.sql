CREATE TABLE `garment_canvas_preferences` (
  `owner_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `garment_client_id` text NOT NULL,
  `scale_multiplier` real NOT NULL CHECK (`scale_multiplier` > 0 AND `scale_multiplier` <= 20),
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`owner_id`, `garment_client_id`)
);
