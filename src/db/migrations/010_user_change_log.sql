-- Migration 010: change log for a member's date-stamped history (OSVS-25/26)
-- Every create/update/delete of a tjänst (users_officials) or utmärkelse
-- (users_achievements) entry is recorded here in the same transaction as the
-- change. `entryId` is intentionally not a foreign key: the referenced row may
-- have been deleted. `oldValue`/`newValue` hold JSON snapshots of the entry
-- (officialId/achievementId, title, dates) before and after the change.
CREATE TABLE `user_change_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `entityType` enum('official', 'achievement') NOT NULL,
  `action` enum('create', 'update', 'delete') NOT NULL,
  `entryId` int(11) NOT NULL,
  `itemId` int(11) DEFAULT NULL,
  `oldValue` json DEFAULT NULL,
  `newValue` json DEFAULT NULL,
  `note` text DEFAULT NULL,
  `editorId` int(11) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_change_log_uid_created` (`uid`, `createdAt`),
  KEY `idx_user_change_log_entity_entry` (`entityType`, `entryId`),
  KEY `fk_user_change_log_editor` (`editorId`),
  CONSTRAINT `fk_user_change_log_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_change_log_editor` FOREIGN KEY (`editorId`) REFERENCES `users` (`matrikelnummer`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
