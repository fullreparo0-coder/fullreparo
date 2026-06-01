CREATE TABLE `tenant_billing_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`planId` int,
	`amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` enum('pending','paid','overdue','cancelled') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp NOT NULL,
	`paidAt` timestamp,
	`method` varchar(60),
	`notes` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_billing_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tenant_billing_records_tenant_idx` ON `tenant_billing_records` (`tenantId`);
--> statement-breakpoint
CREATE INDEX `tenant_billing_records_status_idx` ON `tenant_billing_records` (`status`);
--> statement-breakpoint
CREATE INDEX `tenant_billing_records_due_date_idx` ON `tenant_billing_records` (`dueDate`);
