CREATE TABLE `budget_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`budgetId` int NOT NULL,
	`description` varchar(300) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL,
	`totalPrice` decimal(10,2) NOT NULL,
	`type` enum('service','part') NOT NULL DEFAULT 'service',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budget_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`description` text,
	`laborCost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`partsCost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalCost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`validUntil` timestamp,
	`approvedAt` timestamp,
	`rejectedAt` timestamp,
	`rejectionReason` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20) NOT NULL,
	`document` varchar(20),
	`address` text,
	`city` varchar(100),
	`state` varchar(2),
	`zipCode` varchar(10),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`customerId` int NOT NULL,
	`brand` varchar(100) NOT NULL,
	`model` varchar(200) NOT NULL,
	`type` varchar(100),
	`imei` varchar(50),
	`serialNumber` varchar(100),
	`color` varchar(50),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `os_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`item` varchar(200) NOT NULL,
	`checked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `os_checklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `os_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`status` varchar(50) NOT NULL,
	`notes` text,
	`changedById` int,
	`changedByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `os_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`method` enum('dinheiro','pix','cartao_credito','cartao_debito','transferencia','outro') NOT NULL,
	`status` enum('pending','paid','refunded','cancelled') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`notes` text,
	`receivedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` text NOT NULL,
	`type` enum('entrada','coleta','entrega','diagnostico','outro') NOT NULL DEFAULT 'entrada',
	`caption` varchar(200),
	`uploadedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`delivererId` int,
	`type` enum('coleta','entrega') NOT NULL,
	`status` enum('pending','assigned','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`address` text NOT NULL,
	`scheduledAt` timestamp,
	`completedAt` timestamp,
	`photoUrl` text,
	`photoKey` text,
	`signatureUrl` text,
	`signatureKey` text,
	`notes` text,
	`recipientName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`maxUsers` int NOT NULL DEFAULT 3,
	`maxOsPerMonth` int NOT NULL DEFAULT 50,
	`hasPickupDelivery` boolean NOT NULL DEFAULT false,
	`hasOnlineBudget` boolean NOT NULL DEFAULT false,
	`hasWhatsapp` boolean NOT NULL DEFAULT false,
	`hasClientPortal` boolean NOT NULL DEFAULT false,
	`hasStock` boolean NOT NULL DEFAULT false,
	`hasFinancial` boolean NOT NULL DEFAULT false,
	`hasReports` boolean NOT NULL DEFAULT false,
	`hasAdvancedCustomization` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `service_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`osNumber` varchar(20) NOT NULL,
	`customerId` int NOT NULL,
	`deviceId` int,
	`origin` enum('balcao','coleta') NOT NULL DEFAULT 'balcao',
	`status` enum('solicitado','aguardando_coleta','coleta_agendada','coletado','recebido_na_assistencia','em_diagnostico','aguardando_aprovacao','aprovado','recusado','aguardando_peca','em_reparo','pronto','aguardando_entrega','saiu_para_entrega','entregue','finalizado','cancelado') NOT NULL DEFAULT 'recebido_na_assistencia',
	`reportedDefect` text NOT NULL,
	`physicalCondition` text,
	`accessories` text,
	`devicePassword` varchar(100),
	`internalNotes` text,
	`technicianId` int,
	`attendantId` int,
	`estimatedDelivery` timestamp,
	`deliveryAddress` text,
	`pickupAddress` text,
	`preferredPickupTime` varchar(100),
	`warrantyDays` int DEFAULT 90,
	`totalAmount` decimal(10,2) DEFAULT '0.00',
	`publicToken` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`sku` varchar(100),
	`category` varchar(100),
	`brand` varchar(100),
	`model` varchar(200),
	`quantity` int NOT NULL DEFAULT 0,
	`minQuantity` int NOT NULL DEFAULT 1,
	`costPrice` decimal(10,2) DEFAULT '0.00',
	`salePrice` decimal(10,2) DEFAULT '0.00',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`document` varchar(20),
	`email` varchar(320),
	`phone` varchar(20),
	`address` text,
	`city` varchar(100),
	`state` varchar(2),
	`zipCode` varchar(10),
	`logoUrl` text,
	`primaryColor` varchar(7) DEFAULT '#1e3a5f',
	`secondaryColor` varchar(7) DEFAULT '#d4a017',
	`whatsappNumber` varchar(20),
	`customDomain` varchar(200),
	`planId` int NOT NULL DEFAULT 1,
	`status` enum('active','blocked','suspended','trial') NOT NULL DEFAULT 'trial',
	`trialEndsAt` timestamp,
	`subscriptionEndsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`serviceOrderId` int NOT NULL,
	`warrantyCode` varchar(50) NOT NULL,
	`description` text,
	`warrantyDays` int NOT NULL DEFAULT 90,
	`startsAt` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`conditions` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warranties_id` PRIMARY KEY(`id`),
	CONSTRAINT `warranties_serviceOrderId_unique` UNIQUE(`serviceOrderId`),
	CONSTRAINT `warranties_warrantyCode_unique` UNIQUE(`warrantyCode`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','tenant_admin','atendente','tecnico','entregador','cliente','user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;