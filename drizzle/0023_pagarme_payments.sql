-- Integração Pagar.me para console do tenant e pagamento do cliente
ALTER TABLE tenants
  ADD COLUMN pagarmeEnabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN pagarmeEnvironment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  ADD COLUMN pagarmePublicKey VARCHAR(255) NULL,
  ADD COLUMN pagarmeSecretKey TEXT NULL,
  ADD COLUMN pagarmeWebhookSecret VARCHAR(255) NULL;

ALTER TABLE service_orders
  ADD COLUMN deliveryAuthorizedAt TIMESTAMP NULL,
  ADD COLUMN deliveryAuthorizedIp VARCHAR(45) NULL,
  ADD COLUMN paymentRequestedAt TIMESTAMP NULL;

ALTER TABLE payments
  MODIFY COLUMN status ENUM('pending','processing','paid','failed','refunded','cancelled') NOT NULL DEFAULT 'pending',
  ADD COLUMN gateway VARCHAR(50) NULL,
  ADD COLUMN gatewayPaymentId VARCHAR(120) NULL,
  ADD COLUMN gatewayOrderId VARCHAR(120) NULL,
  ADD COLUMN gatewayChargeId VARCHAR(120) NULL,
  ADD COLUMN gatewayStatus VARCHAR(80) NULL,
  ADD COLUMN pixQrCode TEXT NULL,
  ADD COLUMN pixQrCodeUrl TEXT NULL,
  ADD COLUMN pixExpiresAt TIMESTAMP NULL,
  ADD COLUMN cardLast4 VARCHAR(4) NULL,
  ADD COLUMN installments INT NULL DEFAULT 1,
  ADD COLUMN metadata JSON NULL;
