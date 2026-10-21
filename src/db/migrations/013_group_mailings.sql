-- Migration 013: group mailings and the outgoing mail queue (OSVS-24)
-- `mailings` is one message sent by an Admin/Editor to the members of a group.
-- The group name and the sender's e-mail are snapshotted so the history stays
-- readable after the group or the sender is deleted (FKs are SET NULL).
-- `mail_outbox` holds one row per recipient, snapshotted when the mailing is
-- created. A background worker (src/services/mailWorker.ts) sends pending rows
-- one message per recipient, throttled by MAIL_RATE_PER_HOUR (counted from
-- `sentAt`). `sending` is the worker's in-progress claim; rows stuck there after
-- a crash are returned to `pending` (`claimToken` identifies one worker claim). Skipped rows carry a `skipReason` code
-- (archived, no_email, placeholder, invalid_email, duplicate, dev_allowlist).
-- `mail_worker_state` is a single row holding the global pause after the SMTP
-- host signals a rate/limit block, so the pause survives restarts.
CREATE TABLE `mailings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `gid` int(11) DEFAULT NULL,
  `groupName` varchar(255) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `body` mediumtext NOT NULL,
  `senderId` int(11) DEFAULT NULL,
  `senderEmail` varchar(256) DEFAULT NULL,
  `status` enum('queued', 'sending', 'done', 'cancelled') NOT NULL DEFAULT 'queued',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mailings_gid_created` (`gid`, `createdAt`),
  KEY `idx_mailings_status` (`status`),
  KEY `fk_mailings_sender` (`senderId`),
  CONSTRAINT `fk_mailings_group` FOREIGN KEY (`gid`) REFERENCES `groups` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mailings_sender` FOREIGN KEY (`senderId`) REFERENCES `users` (`matrikelnummer`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE `mail_outbox` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `mailingId` int(11) NOT NULL,
  `uid` int(11) DEFAULT NULL,
  `toEmail` varchar(256) DEFAULT NULL,
  `status` enum('pending', 'sending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
  `skipReason` varchar(32) DEFAULT NULL,
  `attempts` int(11) NOT NULL DEFAULT 0,
  `lastError` varchar(1000) DEFAULT NULL,
  `nextAttemptAt` datetime DEFAULT NULL,
  `claimedAt` datetime DEFAULT NULL,
  `claimToken` varchar(64) DEFAULT NULL,
  `sentAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mail_outbox_status_next` (`status`, `nextAttemptAt`, `id`),
  KEY `idx_mail_outbox_sentAt` (`sentAt`),
  KEY `idx_mail_outbox_mailing_status` (`mailingId`, `status`),
  KEY `fk_mail_outbox_user` (`uid`),
  CONSTRAINT `fk_mail_outbox_mailing` FOREIGN KEY (`mailingId`) REFERENCES `mailings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mail_outbox_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE `mail_worker_state` (
  `id` tinyint(4) NOT NULL,
  `pausedUntil` datetime DEFAULT NULL,
  `pauseReason` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

INSERT INTO `mail_worker_state` (`id`, `pausedUntil`, `pauseReason`) VALUES (1, NULL, NULL);
