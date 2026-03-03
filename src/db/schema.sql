-- =====================================================
-- OSVS Fraternity Platform - Database Schema
-- =====================================================
-- =====================================================
-- BASE LOOKUP TABLES
-- =====================================================
-- Roles
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role` enum('Admin', 'Editor', 'Member') NOT NULL,
  UNIQUE KEY `uq_roles_role` (`role`),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Lodges
CREATE TABLE `lodges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `city` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `email` varchar(256) DEFAULT NULL,
  `picture` varchar(256) DEFAULT 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/coatOfArmsPlaceholder.webp',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lodges_name` (`name`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Achievements
CREATE TABLE `achievements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` enum(
    'I:a Graden',
    'II:a Graden',
    'III:e Graden',
    'IV:e Graden',
    'V:e Graden',
    'VI:e Graden',
    'VII:e Graden',
    'VIII:e Graden',
    'IX:e Graden',
    'X:e Graden',
    'Förtjänstmedalj',
    'Bärare av Stiftarband',
    'Ordensring',
    '25 år Veteran',
    '40 år Veteran',
    '50 år Veteran'
  ) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Officials
CREATE TABLE `officials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` enum(
    'Ordensmästare',
    'Ordenssekreterare',
    'Logemästare',
    'Logekansler',
    'Logesekreterare',
    'Logeskattmästare',
    'Överceremonimästare',
    'Ceremonimästare',
    'Orator',
    'Visdomens Broder',
    'Instruktionsbroder',
    'Ledande Broder',
    'Ljudtekniker',
    'Intendent',
    'Biträdande Intendent',
    'Kanslisekreterare',
    'Director Musices',
    'Klubbmästare',
    'Barmästare',
    'Biträdande Barmästare',
    'Chef för köksförvaltningen',
    'Biträdande Chef för köksförvaltningen',
    'Webmaster',
    'Webbredaktör',
    'Borgfogde',
    'Förtroendeutskottet',
    'Kurator'
  ) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_officials_title` (`title`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Allergies
CREATE TABLE `allergies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` enum(
    'Gluten',
    'Laktos',
    'Ägg',
    'Fisk',
    'Skaldjur',
    'Nötter',
    'Soja',
    'Sädeskorn'
  ) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_allergies_title` (`title`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- =====================================================
-- MAIN ENTITIES
-- =====================================================
-- Users
CREATE TABLE `users` (
  `matrikelnummer` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(256) NOT NULL,
  `passwordHash` varchar(512) NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `picture` varchar(256) NOT NULL DEFAULT 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/profiles/profilePlaceholder.png',
  `archive` enum('Deceased', 'Retired', 'Removed') DEFAULT NULL,
  `firstname` varchar(256) NOT NULL,
  `lastname` varchar(256) NOT NULL,
  `dateOfBirth` date NOT NULL,
  `work` varchar(256) DEFAULT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `mobile` varchar(20) NOT NULL,
  `homeNumber` varchar(20) DEFAULT NULL,
  `city` varchar(256) NOT NULL,
  `address` varchar(256) NOT NULL,
  `zipcode` varchar(10) NOT NULL,
  `lat` decimal(10, 7) DEFAULT NULL,
  `lng` decimal(10, 7) DEFAULT NULL,
  `geocode_source` enum('AUTO', 'MANUAL') NOT NULL DEFAULT 'AUTO',
  `geocode_status` enum('OK', 'FAILED', 'NEEDS_MANUAL') DEFAULT NULL,
  `geocode_last_attempt_at` datetime DEFAULT NULL,
  `geocode_query_hash` char(64) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `accommodationAvailable` tinyint(1) DEFAULT 0,
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_matrikelnummer` (`matrikelnummer`),
  PRIMARY KEY (`matrikelnummer`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE `geocode_cache` (
  `query_hash` char(64) NOT NULL,
  `query_text` varchar(255) NOT NULL,
  `lat` decimal(10, 7) DEFAULT NULL,
  `lng` decimal(10, 7) DEFAULT NULL,
  `status` enum('OK', 'FAILED') NOT NULL,
  `raw_json` json DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP() ON UPDATE CURRENT_TIMESTAMP(),
  PRIMARY KEY (`query_hash`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Posts
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `picture` varchar(256) NOT NULL DEFAULT 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png',
  `publicum` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Events
CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `lodgeMeeting` tinyint(1) NOT NULL DEFAULT 0,
  `food` tinyint(1) NOT NULL DEFAULT 0,
  `price` decimal(10, 2) NOT NULL,
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Event attendances (RSVP)
CREATE TABLE `events_attendances` (
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  `rsvp` tinyint(1) NOT NULL DEFAULT 0,
  `bookFood` tinyint(1) NOT NULL DEFAULT 0,
  `attended` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`, `eid`),
  KEY `fk_events_attendances_event` (`eid`),
  CONSTRAINT `fk_events_attendances_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_events_attendances_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Revisions 
CREATE TABLE `revisions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lid` int(11) NOT NULL,
  `title` varchar(256) NOT NULL,
  `year` date NOT NULL,
  `picture` varchar(256) NOT NULL DEFAULT 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/coatOfArmsPlaceholder.webp',
  PRIMARY KEY (`id`),
  KEY `fk_revisions_lodge` (`lid`),
  CONSTRAINT `fk_revisions_lodge` FOREIGN KEY (`lid`) REFERENCES `lodges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Documents
CREATE TABLE `documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `picture` varchar(256) NOT NULL DEFAULT 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/documentPlaceholder.png',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- =====================================================
-- AUTHENTICATION TABLES
-- =====================================================
-- Revoked JWT JTIs (blacklist for logout) - store token id instead of full token
CREATE TABLE `revoked_tokens` (
  `jti` varchar(128) NOT NULL,
  `expiresAt` datetime NOT NULL,
  PRIMARY KEY (`jti`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Refresh tokens for long-lived session renewal (rotate on use)
CREATE TABLE `refresh_tokens` (
  `token_hash` varchar(128) NOT NULL,
  `uid` int(11) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `isRevoked` tinyint(1) NOT NULL DEFAULT 0,
  `replacedBy` varchar(128) DEFAULT NULL,
  `lastUsed` datetime DEFAULT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `fk_refresh_token_user` (`uid`),
  CONSTRAINT `fk_refresh_token_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- =====================================================
-- RELATION / JUNCTION TABLES
-- =====================================================
-- Users ↔ Roles
CREATE TABLE `users_roles` (
  `uid` int(11) NOT NULL,
  `rid` int(11) NOT NULL,
  PRIMARY KEY (`uid`, `rid`),
  KEY `fk_user_roles_role` (`rid`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`rid`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Users ↔ Lodges
CREATE TABLE `users_lodges` (
  `uid` int(11) NOT NULL,
  `lid` int(11) NOT NULL,
  PRIMARY KEY (`uid`, `lid`),
  KEY `fk_user_lodges_lodge_fixed` (`lid`),
  CONSTRAINT `fk_user_lodges_lodge_fixed` FOREIGN KEY (`lid`) REFERENCES `lodges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_lodges_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Users ↔ Achievements (which user has which achievement)
CREATE TABLE `users_achievements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `aid` int(11) NOT NULL,
  `awardedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_users_achievements_achievement` (`aid`),
  KEY `fk_users_achievements_user` (`uid`),
  CONSTRAINT `fk_users_achievements_achievement` FOREIGN KEY (`aid`) REFERENCES `achievements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_users_achievements_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Users ↔ Officials (which user has which official position, with appointment and optional unappointment date for history)
CREATE TABLE `users_officials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `oid` int(11) NOT NULL,
  `appointedAt` datetime NOT NULL,
  `unAppointedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_users_officials_uid_unappointed` (`uid`, `unAppointedAt`),
  KEY `idx_users_officials_uid_oid_unappointed` (`uid`, `oid`, `unAppointedAt`),
  KEY `idx_users_officials_uid_unappointed_appointed` (`uid`, `unAppointedAt`, `appointedAt`),
  KEY `fk_users_officials_official` (`oid`),
  CONSTRAINT `fk_users_officials_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_users_officials_official` FOREIGN KEY (`oid`) REFERENCES `officials` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE `users_allergies` (
  `uid` int(11) NOT NULL,
  `alid` int(11) NOT NULL,
  PRIMARY KEY (`uid`, `alid`),
  KEY `fk_users_allergies_user` (`uid`),
  KEY `fk_users_allergies_allergy` (`alid`),
  CONSTRAINT `fk_users_allergies_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_users_allergies_allergy` FOREIGN KEY (`alid`) REFERENCES `allergies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Lodges ↔ Events (link events to lodges)
CREATE TABLE `lodges_events` (
  `lid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`lid`, `eid`),
  KEY `fk_lodges_events_event` (`eid`),
  CONSTRAINT `fk_lodges_events_lodge` FOREIGN KEY (`lid`) REFERENCES `lodges` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_lodges_events_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Lodges ↔ Posts (link lodges to posts)
CREATE TABLE `lodges_posts` (
  `lid` int(11) NOT NULL,
  `pid` int(11) NOT NULL,
  PRIMARY KEY (`lid`, `pid`),
  KEY `fk_lodges_posts_post` (`pid`),
  CONSTRAINT `fk_lodges_posts_lodge` FOREIGN KEY (`lid`) REFERENCES `lodges` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_lodges_posts_post` FOREIGN KEY (`pid`) REFERENCES `posts` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- =====================================================
-- PAYMENT TABLES
-- =====================================================
-- Membership payments (yearly)
CREATE TABLE `membership_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `amount` decimal(10, 2) NOT NULL DEFAULT 600.00,
  `year` int(11) NOT NULL,
  `status` enum('Pending', 'Paid') NOT NULL DEFAULT 'Pending',
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_membership_uid_year` (`uid`, `year`),
  KEY `fk_membership_payments_user` (`uid`),
  CONSTRAINT `fk_membership_payments_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Event payments
CREATE TABLE `event_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  `amount` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `status` enum('Pending', 'Paid') NOT NULL DEFAULT 'Pending',
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_payments_uid_eid` (`uid`, `eid`),
  KEY `fk_event_payments_user` (`uid`),
  KEY `fk_event_payments_event` (`eid`),
  CONSTRAINT `fk_event_payments_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_event_payments_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
