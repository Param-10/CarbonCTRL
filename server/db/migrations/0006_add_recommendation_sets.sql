CREATE TABLE `recommendation_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`payload` text NOT NULL,
	`input_fingerprint` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_sets_user_id_unique` ON `recommendation_sets` (`user_id`);