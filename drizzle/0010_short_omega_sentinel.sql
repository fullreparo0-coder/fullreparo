ALTER TABLE `service_orders` ADD `termsAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `service_orders` ADD `termsAcceptedIp` varchar(45);--> statement-breakpoint
ALTER TABLE `tenants` ADD `serviceTerms` text;