UPDATE `plans` SET `hasWhatsapp` = true WHERE `price` >= 99.00;
--> statement-breakpoint
CREATE TABLE `whatsapp_integrations` (
`id` int AUTO_INCREMENT NOT NULL,
`tenantId` int NOT NULL,
`enabled` boolean NOT NULL DEFAULT false,
`provider` varchar(40) NOT NULL DEFAULT 'meta_cloud_api',
`displayName` varchar(120),
`businessAccountId` varchar(120),
`phoneNumberId` varchar(120),
`phoneNumber` varchar(30),
`accessToken` text,
`graphApiVersion` varchar(20) NOT NULL DEFAULT 'v23.0',
`budgetTemplateName` varchar(120) NOT NULL DEFAULT 'fullreparo_orcamento_disponivel',
`readyTemplateName` varchar(120) NOT NULL DEFAULT 'fullreparo_os_pronta',
`templateLanguage` varchar(20) NOT NULL DEFAULT 'pt_BR',
`lastHealthStatus` varchar(40) NOT NULL DEFAULT 'not_configured',
`lastHealthMessage` text,
`lastCheckedAt` timestamp,
`createdAt` timestamp NOT NULL DEFAULT (now()),
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `whatsapp_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_message_logs` (
`id` int AUTO_INCREMENT NOT NULL,
`tenantId` int NOT NULL,
`serviceOrderId` int NOT NULL,
`customerId` int,
`eventType` varchar(50) NOT NULL,
`templateName` varchar(120) NOT NULL,
`templateLanguage` varchar(20) NOT NULL DEFAULT 'pt_BR',
`toPhone` varchar(30) NOT NULL,
`status` enum('queued','sent','skipped','failed') NOT NULL DEFAULT 'queued',
`metaMessageId` varchar(160),
`requestPayload` json,
`responsePayload` json,
`errorMessage` text,
`estimatedCostUsd` decimal(10,4),
`createdAt` timestamp NOT NULL DEFAULT (now()),
`sentAt` timestamp,
`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
CONSTRAINT `whatsapp_message_logs_id` PRIMARY KEY(`id`)
);
