ALTER TABLE `customers` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `customers` ADD `passwordMustChange` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `localLoginEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `lastLocalLoginAt` timestamp;