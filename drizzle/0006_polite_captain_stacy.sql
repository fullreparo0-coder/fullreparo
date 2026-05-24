CREATE TABLE `checklist_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(200) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklist_templates_id` PRIMARY KEY(`id`)
);
