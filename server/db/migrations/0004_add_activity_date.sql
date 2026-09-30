ALTER TABLE `carbon_activities` ADD `activity_date` text;--> statement-breakpoint
UPDATE `carbon_activities` SET `activity_date` = date(`created_at` / 1000, 'unixepoch') WHERE `activity_date` IS NULL;
