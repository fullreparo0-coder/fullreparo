ALTER TABLE `service_orders` ADD `pickupLatitude` decimal(10,7);
--> statement-breakpoint
ALTER TABLE `service_orders` ADD `pickupLongitude` decimal(10,7);
--> statement-breakpoint
ALTER TABLE `service_orders` ADD `pickupLocationAccuracy` int;
