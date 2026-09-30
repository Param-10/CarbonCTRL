CREATE TABLE `action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`sector` text,
	`annual_impact` real DEFAULT 0 NOT NULL,
	`cost` text,
	`timeline` text,
	`priority` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `action_items_user_id_idx` ON `action_items` (`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `monthly_reminders` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_reminder_month` text;