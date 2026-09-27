ALTER TABLE `users` ADD `name` text;
--> statement-breakpoint
UPDATE `users` SET `name` = NULLIF(TRIM(COALESCE(`first_name`, '') || ' ' || COALESCE(`last_name`, '')), '');
