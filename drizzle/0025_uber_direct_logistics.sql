ALTER TABLE `tenants` ADD COLUMN `ownDeliveryEnabled` BOOLEAN NOT NULL DEFAULT TRUE;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `uberDirectEnabled` BOOLEAN NOT NULL DEFAULT FALSE;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `uberDirectEnvironment` VARCHAR(20) NOT NULL DEFAULT 'sandbox';
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `uberDirectCustomerId` VARCHAR(128) NULL;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `uberDirectClientId` VARCHAR(255) NULL;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `uberDirectClientSecret` TEXT NULL;
