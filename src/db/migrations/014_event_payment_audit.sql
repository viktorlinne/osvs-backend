-- Migration 014: audit trail for event payments (manual "markera betald", SWISH.md §4-5)
-- `event_payments` keeps `status` Pending/Paid so existing code keeps working.
-- The new columns describe the CURRENT paid state: when (`paidAt`), by whom
-- (`paidBy`, the Admin/Editor for manual marking, NULL for Swish) and how
-- (`method`: 'manual' now, 'swish' later from the Swish callback). They are
-- cleared again when a payment is reverted to Pending. `note` holds the note of
-- the latest change. `updatedAt` already exists (001).
-- Existing Paid rows are not backfilled: their audit columns stay NULL.
--
-- `event_payment_log` is append-only: one row per change of paid state (paid or
-- unpaid), written in the same transaction as the change. `eid`/`uid` are
-- intentionally not foreign keys so the history outlives a deleted event or
-- payment row (as in user_change_log). `byUid` is SET NULL when that user is
-- deleted.
ALTER TABLE `event_payments`
  ADD COLUMN `paidAt` datetime DEFAULT NULL AFTER `status`,
  ADD COLUMN `paidBy` int(11) DEFAULT NULL AFTER `paidAt`,
  ADD COLUMN `method` enum('manual', 'swish') DEFAULT NULL AFTER `paidBy`,
  ADD COLUMN `note` varchar(500) DEFAULT NULL AFTER `method`,
  ADD KEY `idx_event_payments_status_eid` (`status`, `eid`),
  ADD KEY `fk_event_payments_paid_by` (`paidBy`),
  ADD CONSTRAINT `fk_event_payments_paid_by` FOREIGN KEY (`paidBy`) REFERENCES `users` (`matrikelnummer`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `event_payment_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `eid` int(11) NOT NULL,
  `uid` int(11) NOT NULL,
  `action` enum('paid', 'unpaid') NOT NULL,
  `method` enum('manual', 'swish') NOT NULL,
  `previousMethod` enum('manual', 'swish') DEFAULT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `byUid` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_event_payment_log_eid_uid` (`eid`, `uid`, `createdAt`),
  KEY `fk_event_payment_log_by` (`byUid`),
  CONSTRAINT `fk_event_payment_log_by` FOREIGN KEY (`byUid`) REFERENCES `users` (`matrikelnummer`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
