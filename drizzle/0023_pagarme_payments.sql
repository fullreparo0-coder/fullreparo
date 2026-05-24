-- Integração Pagar.me para console do tenant e pagamento do cliente
ALTER TABLE `tenants` ADD COLUMN `pagarmeEnabled` BOOLEAN NOT NULL DEFAULT FALSE;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `pagarmeEnvironment` VARCHAR(20) NOT NULL DEFAULT 'sandbox';
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `pagarmePublicKey` VARCHAR(255) NULL;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `pagarmeSecretKey` TEXT NULL;
--> statement-breakpoint
ALTER TABLE `tenants` ADD COLUMN `pagarmeWebhookSecret` VARCHAR(255) NULL;
--> statement-breakpoint
ALTER TABLE `service_orders` ADD COLUMN `deliveryAuthorizedAt` TIMESTAMP NULL;
--> statement-breakpoint
ALTER TABLE `service_orders` ADD COLUMN `deliveryAuthorizedIp` VARCHAR(45) NULL;
--> statement-breakpoint
ALTER TABLE `service_orders` ADD COLUMN `paymentRequestedAt` TIMESTAMP NULL;
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `status` ENUM('pending','processing','paid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `gateway` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `gatewayPaymentId` VARCHAR(120) NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `gatewayOrderId` VARCHAR(120) NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `gatewayChargeId` VARCHAR(120) NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `gatewayStatus` VARCHAR(80) NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `pixQrCode` TEXT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `pixQrCodeUrl` TEXT NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `pixExpiresAt` TIMESTAMP NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `cardLast4` VARCHAR(4) NULL;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `installments` INT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `payments` ADD COLUMN `metadata` JSON NULL;
