CREATE TABLE `os_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`status` varchar(50) NOT NULL,
	`channel` varchar(20) NOT NULL DEFAULT 'whatsapp',
	`message` text NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `os_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tenants` ADD `notifyStatuses` text;