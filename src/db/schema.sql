-- =====================================================
-- OSVS Fraternity Platform - Database Schema
-- =====================================================

-- 1. Create and select database
CREATE DATABASE IF NOT EXISTS osvs
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE osvs;

-- 2. Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- BASE TABLES
-- =====================================================

-- Roles
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role` enum('Admin','Editor','Member') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Lodges
CREATE TABLE `lodges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `description` varchar(256) NOT NULL,
  `address` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Establishments
CREATE TABLE `establishments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `description` varchar (256) NOT NULL,
  `address` varchar(256) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Users
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(256) NOT NULL,
  `email` varchar(256) NOT NULL,
  `passwordHash` varchar(512) NOT NULL,
  `createdAt` date NOT NULL,
  `picture` varchar(256) NOT NULL,
  `archive` enum('Deceased','Retired','Removed') DEFAULT NULL,
  `firstname` varchar(256) NOT NULL,
  `lastname` varchar(256) NOT NULL,
  `dateOfBirth` date NOT NULL,
  `official` varchar(256) DEFAULT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `mobile` varchar(256) NOT NULL,
  `homeNumber` varchar(256) DEFAULT NULL,
  `city` varchar(256) NOT NULL,
  `address` varchar(256) NOT NULL,
  `zipcode` varchar(256) NOT NULL,
  `notes` text DEFAULT NULL,
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Posts
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` varchar(256) NOT NULL,
  `picture` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Events
CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `lodgeMeeting` tinyint(1),
  `price` decimal(10,2) NOT NULL,
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Mails
CREATE TABLE `mails` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lid` int(11) NOT NULL,
  `title` varchar(256) NOT NULL,
  `content` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_mails_lodge` (`lid`),
  CONSTRAINT `fk_mails_lodge` FOREIGN KEY (`lid`)
    REFERENCES `lodges` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- RELATION / JUNCTION TABLES
-- =====================================================

-- Users ↔ Roles
CREATE TABLE `users_roles` (
  `uid` int(11) NOT NULL,
  `rid` int(11) NOT NULL,
  PRIMARY KEY (`uid`,`rid`),
  KEY `fk_user_roles_role` (`rid`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`rid`)
    REFERENCES `roles` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- Users ↔ Lodges
CREATE TABLE `users_lodges` (
  `uid` int(11) NOT NULL,
  `lid` int(11) NOT NULL,
  PRIMARY KEY (`uid`,`lid`),
  KEY `fk_user_lodges_lodge_fixed` (`lid`),
  CONSTRAINT `fk_user_lodges_lodge_fixed` FOREIGN KEY (`lid`)
    REFERENCES `lodges` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_lodges_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Lodges ↔ Establishments
CREATE TABLE `lodges_establishments` (
  `lid` int(11) NOT NULL,
  `esid` int(11) NOT NULL,
  PRIMARY KEY (`lid`,`esid`),
  KEY `fk_lodges_establishments_establishment` (`esid`),
  CONSTRAINT `fk_lodges_establishments_establishment` FOREIGN KEY (`esid`)
    REFERENCES `establishments` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_lodges_establishments_lodge` FOREIGN KEY (`lid`)
    REFERENCES `lodges` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Lodges ↔ Events (link events to lodges)
CREATE TABLE `lodges_events` (
  `lid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`lid`,`eid`),
  KEY `fk_lodges_events_event` (`eid`),
  CONSTRAINT `fk_lodges_events_lodge` FOREIGN KEY (`lid`)
    REFERENCES `lodges` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT `fk_lodges_events_event` FOREIGN KEY (`eid`)
    REFERENCES `events` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Establishments ↔ Events (link events to establishments)
CREATE TABLE `establishments_events` (
  `esid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`esid`,`eid`),
  KEY `fk_establishments_events_event` (`eid`),
  CONSTRAINT `fk_establishments_events_establishment` FOREIGN KEY (`esid`)
    REFERENCES `establishments` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_establishments_events_event` FOREIGN KEY (`eid`)
    REFERENCES `events` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Achievements
CREATE TABLE `achievements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` enum('I:a Graden','II:a Graden','III:e Graden') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Users ↔ Achievements (which user has which achievement)
CREATE TABLE `users_achievements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `aid` int(11) NOT NULL,
  `awardedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_users_achievements_achievement` (`aid`),
  KEY `fk_users_achievements_user` (`uid`),
  CONSTRAINT `fk_users_achievements_achievement` FOREIGN KEY (`aid`)
    REFERENCES `achievements` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_users_achievements_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- Seed data for local development / tests
-- Ensures an `alice` user and a second example user exist, with roles and one achievement
-- These statements are idempotent where practical.
-- =====================================================

-- Roles (ensure base roles exist)
INSERT INTO `roles` (`id`, `role`) VALUES
  (1, 'Admin'),
  (2, 'Editor'),
  (3, 'Member')
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`);

-- Achievements (ensure enum titles are present)
INSERT INTO `achievements` (`id`, `title`) VALUES
  (1, 'I:a Graden'),
  (2, 'II:a Graden'),
  (3, 'III:e Graden')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- Users: Alice (id=1) and example Bob (id=2)
-- Note: passwordHash uses SHA256 for a deterministic seeded value for local testing.
INSERT INTO `users` (
  `id`, `username`, `email`, `passwordHash`, `createdAt`, `picture`, `firstname`, `lastname`, `dateOfBirth`, `official`, `mobile`, `homeNumber`, `city`, `address`, `zipcode`, `notes`
) VALUES
  (
    1,
    'alice',
    'alice@example.com',
    "$argon2id$v=19$m=65536,t=3,p=1$yi69mW2ZDIaddQpXVbvcUg$oplrjJ0wXLbRBEGxGxWf7UhCXtcDibLPxRIv0A+DXcE",
    CURRENT_DATE(),
    "profiles/picturePlaceholder.png",
    'Alice',
    'Example',
    '1985-06-15',
    'Software Engineer',
    '+46701234567',
    NULL,
    'Stockholm',
    'Storgatan 1',
    '11122',
    NULL
  ),
  (
    2,
    'bob',
    'bob@example.com',
    "$argon2id$v=19$m=65536,t=3,p=1$rDHqFYtGQFkrtQB+z/qo1A$qMOLscJ+esVBDhUfeg3wN6IxI0bqllCMR80jRLmJBkE",
    CURRENT_DATE(),
    "profiles/picturePlaceholder.png",
    'Bob',
    'Tester',
    '1990-01-01',
    'QA',
    '+46709876543',
    NULL,
    'Stockholm',
    'Testvägen 2',
    '22233',
    NULL
  )
 ,
  (
    3,
    'viktorlinne',
    'viktor.linne@gmail.com',
    "$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA",
    CURRENT_DATE(),
    "profiles/picturePlaceholder.png",
    'Viktor',
    'Linné',
    '2002-01-18',
    'Webadmin',
    '+46708788520',
    NULL,
    'Kungsbacka',
    '',
    '43490',
    NULL
  )
ON DUPLICATE KEY UPDATE
  `username` = VALUES(`username`),
  `email` = VALUES(`email`),
  `passwordHash` = VALUES(`passwordHash`),
  `picture` = VALUES(`picture`),
  `firstname` = VALUES(`firstname`),
  `lastname` = VALUES(`lastname`),
  `dateOfBirth` = VALUES(`dateOfBirth`),
  `official` = VALUES(`official`),
  `mobile` = VALUES(`mobile`),
  `homeNumber` = VALUES(`homeNumber`),
  `city` = VALUES(`city`),
  `address` = VALUES(`address`),
  `zipcode` = VALUES(`zipcode`),
  `notes` = VALUES(`notes`);

-- Lodges seed (ensure some lodges exist for local/dev testing)
INSERT INTO `lodges` (`id`, `name`, `description`, `address`) VALUES
  (1, 'Stamlogen', 'Första Logen', 'Storgatan 5'),
  (2, 'Stella Polaris', 'Andra Logen', 'Nordvägen 2'),
  (3, 'Regulus', 'Tredje Logen', 'Testvägen 3'),
  (4, 'Orion', 'Fjärde Logen', 'Stadsgatan 4'),
  (5, 'Capella', 'Femte Logen', 'Hamngatan 6')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`), `address` = VALUES(`address`);

-- Establishments seed (ensure some establishments exist for local/dev testing)
INSERT INTO `establishments` (`id`, `name`, `description`, `address`) VALUES
  (1, 'Main Hall', 'Central meeting hall', 'Storgatan 10'),
  (2, 'North Lodge', 'Secondary meeting place', 'Nordvägen 5')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `description` = VALUES(`description`), `address` = VALUES(`address`);

-- Assign roles: give Alice all roles (1,2,3) and Bob the Member role (3)
-- Replace any existing role assignments for these seeded users to keep test state predictable.
DELETE FROM `users_roles` WHERE `uid` IN (1,2,3);
INSERT INTO `users_roles` (`uid`, `rid`) VALUES
  (1,1), (1,2), (1,3),
  (2,3),
  (3,1), (3,2), (3,3);
  
-- Ensure a sample achievement exists for Bob (single, replace any existing for that user/achievement)
DELETE FROM `users_achievements` WHERE `uid` = 2 AND `aid` = 1;
INSERT INTO `users_achievements` (`uid`, `aid`, `awardedAt`) VALUES
  (1, 1, '2025-12-01 10:00:00'),
  (2, 1, '2025-12-01 10:00:00');

-- Ensure seeded users have predictable lodge assignments (replace existing assignments)
DELETE FROM `users_lodges` WHERE `uid` IN (1,2,3);
INSERT INTO `users_lodges` (`uid`, `lid`) VALUES
  (1, 1),
  (2, 2),
  (3, 1)
ON DUPLICATE KEY UPDATE `lid` = VALUES(`lid`);


-- Seed events for local/dev testing
INSERT INTO `events` (`id`, `title`, `description`, `lodgeMeeting`, `price`, `startDate`, `endDate`) VALUES
  (1, 'Founders Meeting', 'Annual founders meeting and dinner.', 1, 275.00, '2026-02-14 18:00:00', '2026-02-14 21:00:00'),
  (2, 'Summer Gathering', 'Open summer gathering with activities.', 0, 0.00, '2026-06-20 10:00:00', '2026-06-20 18:00:00')
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `description` = VALUES(`description`),
  `lodgeMeeting` = VALUES(`lodgeMeeting`),
  `price` = VALUES(`price`),
  `startDate` = VALUES(`startDate`),
  `endDate` = VALUES(`endDate`);

-- Seed relationships: attach events to lodges and establishments for local testing
DELETE FROM `lodges_events` WHERE (lid, eid) IN ((1,1),(2,2));
INSERT INTO `lodges_events` (`lid`, `eid`) VALUES
  (1,1),
  (2,2)
ON DUPLICATE KEY UPDATE `lid` = VALUES(`lid`), `eid` = VALUES(`eid`);

DELETE FROM `establishments_events` WHERE (esid, eid) IN ((1,1),(2,2));
INSERT INTO `establishments_events` (`esid`, `eid`) VALUES
  (1,1),
  (2,2)
ON DUPLICATE KEY UPDATE `esid` = VALUES(`esid`), `eid` = VALUES(`eid`);

INSERT INTO `posts` (`id`, `title`, `description`, `picture`) VALUES
  (1, 'Welcome to OSVS', 'This is the first post on our new platform!', 'posts/postPlaceholder.png'),
  (2, 'Upcoming Event', 'Join us for our annual gathering next month.', 'posts/postPlaceholder.png')
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `description` = VALUES(`description`),
  `picture` = VALUES(`picture`);

-- Sample mails for local/dev testing
INSERT INTO `mails` (`id`, `lid`, `title`, `content`) VALUES
  (1, 1, 'Welcome Newsletter', 'Welcome to Stamlogen — we´re glad you joined!'),
  (2, 1, 'Event Reminder', 'Reminder: Founders Meeting on 2026-02-14. Please RSVP.')
ON DUPLICATE KEY UPDATE `lid` = VALUES(`lid`), `title` = VALUES(`title`), `content` = VALUES(`content`);

-- Seed some internal inbox entries so the frontend shows messages
-- (moved) seed for users_mails will be inserted after table creation to avoid ordering issues

-- Event attendances (RSVP)
CREATE TABLE IF NOT EXISTS `events_attendances` (
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  `rsvp` tinyint(1) DEFAULT 0 NOT NULL,
  PRIMARY KEY (`uid`,`eid`),
  KEY `fk_events_attendances_event` (`eid`),
  CONSTRAINT `fk_events_attendances_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_events_attendances_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Users ↔ Mails (inbox entries generated when a mail is sent to users)
CREATE TABLE IF NOT EXISTS `users_mails` (
  `uid` int(11) NOT NULL,
  `mid` int(11) NOT NULL,
  `sentAt` datetime NOT NULL,
  `isRead` tinyint(1) NOT NULL DEFAULT 0,
  `delivered` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`,`mid`),
  KEY `fk_users_mails_mail` (`mid`),
  CONSTRAINT `fk_users_mails_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_users_mails_mail` FOREIGN KEY (`mid`) REFERENCES `mails` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- =====================================================
-- PAYMENT TABLES
-- =====================================================

-- Membership payments (yearly)
CREATE TABLE `membership_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `amount` decimal(10,2)  NOT NULL DEFAULT 600.00,
  `year` int(11) NOT NULL,
  `status` enum('Pending','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  `provider` varchar(64) DEFAULT NULL,
  `provider_ref` varchar(256) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'SEK',
  `invoice_token` varchar(128) DEFAULT NULL,
  `expiresAt` datetime DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_membership_uid_year` (`uid`,`year`),
  KEY `fk_membership_payments_user` (`uid`),
  CONSTRAINT `fk_membership_payments_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Event payments (Swish)
CREATE TABLE `event_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('Pending','Paid','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  `provider` varchar(64) DEFAULT NULL,
  `provider_ref` varchar(256) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'SEK',
  `invoice_token` varchar(128) DEFAULT NULL,
  `expiresAt` datetime DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_payments_uid_eid` (`uid`,`eid`),
  KEY `fk_event_payments_user` (`uid`),
  KEY `fk_event_payments_event` (`eid`),
  CONSTRAINT `fk_event_payments_event` FOREIGN KEY (`eid`)
    REFERENCES `events` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT `fk_event_payments_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =====================================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- =====================================================
-- Revoked JWT JTIs (blacklist for logout) - store token id instead of full token
CREATE TABLE IF NOT EXISTS `revoked_tokens` (
  `jti` varchar(128) NOT NULL,
  `expiresAt` datetime NOT NULL,
  PRIMARY KEY (`jti`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Refresh tokens for long-lived session renewal (rotate on use)
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `token_hash` varchar(128) NOT NULL,
  `uid` int(11) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  `isRevoked` tinyint(1) NOT NULL DEFAULT 0,
  `replacedBy` varchar(128) DEFAULT NULL,
  `lastUsed` datetime DEFAULT NULL,
  PRIMARY KEY (`token_hash`),
  KEY `fk_refresh_token_user` (`uid`),
  CONSTRAINT `fk_refresh_token_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Password reset tokens (one-time use) — store hashed token
CREATE TABLE IF NOT EXISTS `password_resets` (
  `token_hash` varchar(128) NOT NULL,
  `uid` int(11) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`token_hash`),
  KEY `fk_password_reset_user` (`uid`),
  CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
