ALTER TABLE `os_notifications` ADD `eventType` varchar(50) DEFAULT 'status_change' NOT NULL;--> statement-breakpoint
ALTER TABLE `os_notifications` ADD `actorName` varchar(200);