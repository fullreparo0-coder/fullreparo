CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`targetType` enum('tenant_user','customer') NOT NULL,
	`userId` int,
	`customerId` int,
	`endpoint` text NOT NULL,
	`endpointHash` varchar(64) NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` text,
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscriptions_endpointHash_unique` UNIQUE(`endpointHash`)
);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_tenant_target_idx` ON `push_subscriptions` (`tenantId`,`targetType`);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`userId`);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_customer_idx` ON `push_subscriptions` (`customerId`);
