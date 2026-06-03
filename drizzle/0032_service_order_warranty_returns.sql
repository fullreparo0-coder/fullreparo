ALTER TABLE `service_orders`
  ADD COLUMN IF NOT EXISTS `orderType` varchar(32) NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS `originalServiceOrderId` int,
  ADD COLUMN IF NOT EXISTS `warrantyReturnStatus` varchar(32),
  ADD COLUMN IF NOT EXISTS `warrantyReturnReason` text,
  ADD COLUMN IF NOT EXISTS `warrantyReturnDiagnosis` text,
  ADD COLUMN IF NOT EXISTS `warrantyReturnResolvedAt` timestamp,
  ADD COLUMN IF NOT EXISTS `warrantyReturnHandledById` int;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `service_orders_order_type_idx` ON `service_orders` (`orderType`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `service_orders_original_service_order_idx` ON `service_orders` (`originalServiceOrderId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `service_orders_warranty_return_status_idx` ON `service_orders` (`warrantyReturnStatus`);
