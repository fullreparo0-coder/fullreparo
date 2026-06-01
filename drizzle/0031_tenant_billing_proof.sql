ALTER TABLE `tenant_billing_records`
  ADD COLUMN IF NOT EXISTS `reviewStatus` enum('none','pending_review','approved','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS `proofFileKey` varchar(500),
  ADD COLUMN IF NOT EXISTS `proofUrl` text,
  ADD COLUMN IF NOT EXISTS `proofMimeType` varchar(100),
  ADD COLUMN IF NOT EXISTS `proofOriginalName` varchar(255),
  ADD COLUMN IF NOT EXISTS `proofSubmittedAt` timestamp,
  ADD COLUMN IF NOT EXISTS `proofSubmittedById` int,
  ADD COLUMN IF NOT EXISTS `reviewedAt` timestamp,
  ADD COLUMN IF NOT EXISTS `reviewedById` int,
  ADD COLUMN IF NOT EXISTS `reviewNotes` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tenant_billing_records_review_status_idx` ON `tenant_billing_records` (`reviewStatus`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tenant_billing_records_proof_submitted_at_idx` ON `tenant_billing_records` (`proofSubmittedAt`);
