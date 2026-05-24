CREATE TABLE `tenant_checklist_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`templateId` int,
	`label` varchar(200) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`isCustom` boolean NOT NULL DEFAULT false,
	`deviceType` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_checklist_overrides_id` PRIMARY KEY(`id`)
);
