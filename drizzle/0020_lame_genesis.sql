ALTER TABLE `tenants` ADD `coverage_deadlines` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `welcome_text` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `notificationEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `tenants` DROP COLUMN `coverageDeadlines`;