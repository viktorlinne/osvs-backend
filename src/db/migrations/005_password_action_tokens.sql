CREATE TABLE `password_action_tokens` (
  `token_hash` varchar(128) NOT NULL,
  `uid` int(11) NOT NULL,
  `purpose` enum('SET_PASSWORD', 'RESET_PASSWORD') NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `consumedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `idx_password_action_tokens_uid_purpose_consumed` (`uid`, `purpose`, `consumedAt`),
  KEY `idx_password_action_tokens_expiresAt` (`expiresAt`),
  CONSTRAINT `fk_password_action_tokens_user`
    FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
