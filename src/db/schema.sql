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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Establishments
CREATE TABLE `establishments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
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
  `picture` varchar(256) DEFAULT NULL,
  `archive` enum('Deceased','Retired','Removed') DEFAULT NULL,
  `firstname` varchar(256) NOT NULL,
  `lastname` varchar(256) NOT NULL,
  `dateOfBirth` date NOT NULL,
  `official` varchar(256) NOT NULL,
  `revokedAt` datetime DEFAULT NULL,
  `counter` int(11) NOT NULL,
  `mobile` varchar(256) NOT NULL,
  `homeNumber` varchar(256) DEFAULT NULL,
  `city` varchar(256) NOT NULL,
  `address` varchar(256) NOT NULL,
  `zipcode` varchar(256) NOT NULL,
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Posts
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` varchar(256) NOT NULL,
  `picture` blob DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Events
CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `price` int(11) NOT NULL,
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

-- Lodges ↔ Events
CREATE TABLE `lodges_events` (
  `lid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`lid`,`eid`),
  KEY `fk_lodges_events_event` (`eid`),
  CONSTRAINT `fk_lodges_events_event` FOREIGN KEY (`eid`)
    REFERENCES `events` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_lodges_events_lodge` FOREIGN KEY (`lid`)
    REFERENCES `lodges` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Establishments ↔ Events
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
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Users ↔ Posts
CREATE TABLE `users_posts` (
  `uid` int(11) NOT NULL,
  `pid` int(11) NOT NULL,
  PRIMARY KEY (`uid`,`pid`),
  KEY `fk_user_posts_post` (`pid`),
  CONSTRAINT `fk_user_posts_post` FOREIGN KEY (`pid`)
    REFERENCES `posts` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_posts_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Users ↔ Mails
CREATE TABLE `users_mails` (
  `uid` int(11) NOT NULL,
  `mid` int(11) NOT NULL,
  PRIMARY KEY (`uid`,`mid`),
  KEY `fk_user_mails_mail` (`mid`),
  CONSTRAINT `fk_user_mails_mail` FOREIGN KEY (`mid`)
    REFERENCES `mails` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_mails_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Event attendances (RSVP)
CREATE TABLE `event_attendances` (
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  `rsvp` tinyint(1) NOT NULL DEFAULT 0,
  `food` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`,`eid`),
  KEY `fk_event_attendances_event` (`eid`),
  CONSTRAINT `fk_event_attendances_event` FOREIGN KEY (`eid`)
    REFERENCES `events` (`id`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_event_attendances_user` FOREIGN KEY (`uid`)
    REFERENCES `users` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Achievements
CREATE TABLE `achievements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Users ↔ Achievements (which user has which achievement)
CREATE TABLE `users_achievements` (
  `uid` int(11) NOT NULL,
  `aid` int(11) NOT NULL,
  `awardedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`uid`,`aid`),
  KEY `fk_users_achievements_achievement` (`aid`),
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
-- PAYMENT TABLES
-- =====================================================

-- Membership payments (yearly)
CREATE TABLE `membership_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `status` enum('approved','paid','failed','expired','refunded') NOT NULL,
  PRIMARY KEY (`id`),
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
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','approved','paid','failed','expired','refunded') NOT NULL,
  `swishId` varchar(256) DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_event_payments_user` (`uid`),
  KEY `fk_event_payments_event` (`eid`),
  CONSTRAINT `fk_event_payments_event` FOREIGN KEY (`eid`)
    REFERENCES `events` (`id`)
    ON UPDATE CASCADE,
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
