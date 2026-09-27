CREATE TABLE `carbon_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assessment_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`sector` text NOT NULL,
	`subsector` text NOT NULL,
	`activity_amount` real NOT NULL,
	`activity_unit` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `carbon_activities_assessment_id_idx` ON `carbon_activities` (`assessment_id`);--> statement-breakpoint
CREATE INDEX `carbon_activities_user_id_idx` ON `carbon_activities` (`user_id`);--> statement-breakpoint
CREATE TABLE `carbon_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`total_emissions` real DEFAULT 0 NOT NULL,
	`grade` text DEFAULT 'N/A' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `carbon_assessments_user_id_created_at_idx` ON `carbon_assessments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `company_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`industry` text NOT NULL,
	`employees` text NOT NULL,
	`location` text NOT NULL,
	`phone` text,
	`email` text,
	`founded` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `company_profiles_user_id_unique` ON `company_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `company_profiles_user_id_idx` ON `company_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `emissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `emissions_user_id_type_idx` ON `emissions` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`first_name` text,
	`last_name` text,
	`is_email_verified` integer DEFAULT false NOT NULL,
	`reset_password_token` text,
	`reset_password_expires` integer,
	`email_verification_token` text,
	`last_login` integer,
	`google_id` text,
	`two_factor_secret` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);