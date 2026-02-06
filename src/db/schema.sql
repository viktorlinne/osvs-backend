-- =====================================================
-- OSVS Fraternity Platform - Database Schema
-- =====================================================
SET
  FOREIGN_KEY_CHECKS = 0;

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

-- =====================================================
-- MAIN ENTITIES
-- =====================================================
-- Users
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(256) NOT NULL,
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
  `notes` text DEFAULT NULL,
  `accommodationAvailable` tinyint(1) DEFAULT 0,
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Posts
CREATE TABLE `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `picture` varchar(256) NOT NULL DEFAULT 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Events
CREATE TABLE `events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `description` text NOT NULL,
  `lodgeMeeting` tinyint(1) NOT NULL DEFAULT 0,
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
  PRIMARY KEY (`uid`, `eid`),
  KEY `fk_events_attendances_event` (`eid`),
  CONSTRAINT `fk_events_attendances_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_events_attendances_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  CONSTRAINT `fk_refresh_token_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Password reset tokens (one-time use) — store hashed token
CREATE TABLE `password_resets` (
  `token_hash` varchar(128) NOT NULL,
  `uid` int(11) NOT NULL,
  `expiresAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`token_hash`),
  KEY `fk_password_reset_user` (`uid`),
  CONSTRAINT `fk_password_reset_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE
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
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Users ↔ Lodges
CREATE TABLE `users_lodges` (
  `uid` int(11) NOT NULL,
  `lid` int(11) NOT NULL,
  PRIMARY KEY (`uid`, `lid`),
  KEY `fk_user_lodges_lodge_fixed` (`lid`),
  CONSTRAINT `fk_user_lodges_lodge_fixed` FOREIGN KEY (`lid`) REFERENCES `lodges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_lodges_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  CONSTRAINT `fk_users_achievements_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE `users_officials` (
  `uid` int(11) NOT NULL,
  `oid` int(11) NOT NULL,
  `appointedAt` datetime NOT NULL,
  `unAppointedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`uid`, `oid`),
  KEY `fk_users_officials_official` (`oid`),
  CONSTRAINT `fk_users_officials_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_users_officials_official` FOREIGN KEY (`oid`) REFERENCES `officials` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
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
  `status` enum('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
  `provider` varchar(64) DEFAULT NULL,
  `provider_ref` varchar(256) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'SEK',
  `invoice_token` varchar(128) DEFAULT NULL,
  `expiresAt` datetime DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_membership_uid_year` (`uid`, `year`),
  KEY `fk_membership_payments_user` (`uid`),
  CONSTRAINT `fk_membership_payments_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- Event payments
CREATE TABLE `event_payments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  `amount` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `status` enum('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
  `provider` varchar(64) DEFAULT NULL,
  `provider_ref` varchar(256) DEFAULT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'SEK',
  `invoice_token` varchar(128) DEFAULT NULL,
  `expiresAt` datetime DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT current_timestamp(),
  `updatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_payments_uid_eid` (`uid`, `eid`),
  KEY `fk_event_payments_user` (`uid`),
  KEY `fk_event_payments_event` (`eid`),
  CONSTRAINT `fk_event_payments_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_event_payments_user` FOREIGN KEY (`uid`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- =====================================================
-- Seed data for local development
-- =====================================================
-- Roles
INSERT INTO
  `roles` (`id`, `role`)
VALUES
  (1, 'Admin'),
  (2, 'Editor'),
  (3, 'Member') ON DUPLICATE KEY
UPDATE
  `role` =
VALUES
  (`role`);

-- Achievements
INSERT INTO
  `achievements` (`id`, `title`)
VALUES
  (1, 'I:a Graden'),
  (2, 'II:a Graden'),
  (3, 'III:e Graden'),
  (4, 'IV:e Graden'),
  (5, 'V:e Graden'),
  (6, 'VI:e Graden'),
  (7, 'VII:e Graden'),
  (8, 'VIII:e Graden'),
  (9, 'IX:e Graden'),
  (10, 'X:e Graden'),
  (11, 'Förtjänstmedalj'),
  (12, 'Bärare av Stiftarband'),
  (13, 'Ordensring'),
  (14, '25 år Veteran'),
  (15, '40 år Veteran'),
  (16, '50 år Veteran') ON DUPLICATE KEY
UPDATE
  `title` =
VALUES
  (`title`);

-- Officials
INSERT INTO
  `officials` (`id`, `title`)
VALUES
  (1, 'Ordensmästare'),
  (2, 'Ordenssekreterare'),
  (3, 'Logemästare'),
  (4, 'Logekansler'),
  (5, 'Logesekreterare'),
  (6, 'Logeskattmästare'),
  (7, 'Överceremonimästare'),
  (8, 'Ceremonimästare'),
  (9, 'Orator'),
  (10, 'Visdomens Broder'),
  (11, 'Instruktionsbroder'),
  (12, 'Ledande Broder'),
  (13, 'Ljudtekniker'),
  (14, 'Intendent'),
  (15, 'Biträdande Intendent'),
  (16, 'Kanslisekreterare'),
  (17, 'Director Musices'),
  (18, 'Klubbmästare'),
  (19, 'Barmästare'),
  (20, 'Biträdande Barmästare'),
  (21, 'Chef för köksförvaltningen'),
  (22, 'Biträdande Chef för köksförvaltningen'),
  (23, 'Webmaster'),
  (24, 'Webbredaktör'),
  (25, 'Borgfogde'),
  (26, 'Förtroendeutskottet'),
  (27, 'Kurator') ON DUPLICATE KEY
UPDATE
  `title` =
VALUES
  (`title`);

-- Lodges
INSERT INTO
  `lodges` (
    `id`,
    `name`,
    `city`,
    `description`,
    `email`,
    `picture`
  )
VALUES
  (
    1,
    'Stamlogen',
    'Karlskrona',
    'Stamlogens Fastighetsförening bildades och verkade i sju år innan man vid ett logemöte 1939 meddelade förvärv av Johanneskapellet och året därefter bildades V - Sexans första Damklubben. Idag har Stamogen 200 medlemmar varav där är 30 i Damklubben.',
    'stamlogen@osvs.se',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/karlskrona.webp'
  ),
  (
    2,
    'Stella Polaris',
    'Helsingborg',
    'Vid släktmiddag i Karlskrona 1930 träffade disponent Ewald Stridh t.f.Styrande Recorn Ernst Johansson och där framförde tanke om kamratförbund i Helsingborg vilket senare välkomnades av bröderna i Karlskrona. Den handlingskraftige Bernhard Rosenlindh knöts till kretsen. Efter målmedvetet arbete gavs så framgång och 6 bröder kunde proformarecipiera i Karlskrona. Instiftning, där 40 blivande bröder deltog, avhölls 1931.Idag är vi ca 70 Bröder i varierande grader.',
    'stellapolaris@osvs.se',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/helsingborg.webp'
  ),
  (
    3,
    'Regulus',
    'Ängelholm',
    'Inpulser till logens bildande kom från broderlogen Helsingborg. Den 27 juli 1932 anordnades ett sammanträffande med intresserade personer i Ängelholm och Helsingborg för information. I januari 1933 hölls invigning i Odd Fellows lokaler i närvaro av Stora Rådets medlemmar. En ny länk i Ordenskedjan bildas. Logens SR var Albin Nilsson. Logen har nu 40 Bröder och c:a 10 Damer.',
    'regulus@osvs.se',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/angelholm.webp'
  ),
  (
    4,
    'Orion',
    'Göteborg',
    'Logen Orion instiftades den 26 februari 1943. Logens tillkomst föregicks av några sammanträden under senare delen av 1942 mellan från Karlskrona till Nya Varvet flyttad militär personal, och personer i Göteborg, som gjort sin värnplikt i Karlskrona. Till Logens Styrande Recor valdes Löjtnant Gustaf Idh. Från 1955 egen fastighet där logelokalen är förlagd. Idag har logen 180 medlemmar och 80 i Damklubben.',
    'orion@osvs.se',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/goteborg.webp'
  ),
  (
    5,
    'Capella',
    'Halmstad',
    'Enligt ett protokoll från Förtroenderådets sammanträde i maj 1974 framgår det, att det gamla önskemålet, att Ordenssamfundet VS finge flera loger än nuvarande fyra, tycktes gå i uppfyllelse. Det gäller en loge i Halmstad, dit många av bröderna från både Göteborg och Ängelholm flyttat. Logen Capella instiftades således den 28 november 1975. Idag har logen 68 Bröder och 25 i Damklubben.',
    'capella@osvs.se',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/halmstad.webp'
  ) ON DUPLICATE KEY
UPDATE
  `name` =
VALUES
  (`name`),
  `city` =
VALUES
  (`city`),
  `description` =
VALUES
  (`description`),
  `email` =
VALUES
  (`email`),
  `picture` =
VALUES
  (`picture`);

-- Users
INSERT INTO
  `users` (
    `id`,
    `username`,
    `email`,
    `passwordHash`,
    `archive`,
    `firstname`,
    `lastname`,
    `dateOfBirth`,
    `work`,
    `revokedAt`,
    `mobile`,
    `homeNumber`,
    `city`,
    `address`,
    `zipcode`,
    `notes`,
    `accommodationAvailable`
  )
VALUES
  (
    1,
    'alice',
    'alice@example.com',
    "$argon2id$v=19$m=65536,t=3,p=1$yi69mW2ZDIaddQpXVbvcUg$oplrjJ0wXLbRBEGxGxWf7UhCXtcDibLPxRIv0A+DXcE",
    NULL,
    'Alice',
    'Example',
    '1985-06-15',
    'Software Engineer',
    NULL,
    '0701234567',
    NULL,
    'Stockholm',
    'Storgatan 1',
    '11122',
    '',
    1
  ),
  (
    2,
    'bob',
    'bob@example.com',
    "$argon2id$v=19$m=65536,t=3,p=1$yi69mW2ZDIaddQpXVbvcUg$oplrjJ0wXLbRBEGxGxWf7UhCXtcDibLPxRIv0A+DXcE",
    NULL,
    'Bob',
    'Tester',
    '1990-01-01',
    'QA',
    NULL,
    '0709876543',
    NULL,
    'Stockholm',
    'Testvägen 2',
    '22233',
    NULL,
    0
  ),
  (
    3,
    'viktorlinne',
    'viktor.linne@gmail.com',
    "$argon2id$v=19$m=65536,t=3,p=1$yi69mW2ZDIaddQpXVbvcUg$oplrjJ0wXLbRBEGxGxWf7UhCXtcDibLPxRIv0A+DXcE",
    NULL,
    'Viktor',
    'Linné',
    '2002-01-18',
    'Webadmin',
    NULL,
    '0708788520',
    NULL,
    'Kungsbacka',
    'Motionsvägen 74',
    '43490',
    NULL,
    NULL
  ) ON DUPLICATE KEY
UPDATE
  `username` =
VALUES
  (`username`),
  `email` =
VALUES
  (`email`),
  `passwordHash` =
VALUES
  (`passwordHash`),
  `archive` =
VALUES
  (`archive`),
  `firstname` =
VALUES
  (`firstname`),
  `lastname` =
VALUES
  (`lastname`),
  `dateOfBirth` =
VALUES
  (`dateOfBirth`),
  `work` =
VALUES
  (`work`),
  `revokedAt` =
VALUES
  (`revokedAt`),
  `mobile` =
VALUES
  (`mobile`),
  `homeNumber` =
VALUES
  (`homeNumber`),
  `city` =
VALUES
  (`city`),
  `address` =
VALUES
  (`address`),
  `zipcode` =
VALUES
  (`zipcode`),
  `notes` =
VALUES
  (`notes`),
  `accommodationAvailable` =
VALUES
  (`accommodationAvailable`);

-- Users ↔ Roles (predictable state)
DELETE FROM
  `users_roles`
WHERE
  `uid` IN (1, 2, 3);

INSERT INTO
  `users_roles` (`uid`, `rid`)
VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 3),
  (3, 1),
  (3, 2),
  (3, 3);

-- Users ↔ Achievements
DELETE FROM
  `users_achievements`
WHERE
  `uid` IN (1, 2, 3);

INSERT INTO
  `users_achievements` (`uid`, `aid`, `awardedAt`)
VALUES
  (1, 1, '2025-12-01 10:00:00'),
  (2, 1, '2025-12-01 10:00:00'),
  (3, 1, '2025-12-01 10:00:00');

-- Users ↔ Officials
DELETE FROM
  `users_officials`
WHERE
  `uid` IN (1, 2, 3);

INSERT INTO
  `users_officials` (`uid`, `oid`, `appointedAt`, `unAppointedAt`)
VALUES
  (1, 1, '2025-12-01 10:00:00', NULL),
  (1, 2, '2025-12-01 10:00:00', NULL),
  (2, 2, '2025-12-01 10:00:00', NULL);

-- Users ↔ Lodges
DELETE FROM
  `users_lodges`
WHERE
  `uid` IN (1, 2, 3);

INSERT INTO
  `users_lodges` (`uid`, `lid`)
VALUES
  (1, 1),
  (2, 2),
  (3, 1);

-- Events
INSERT INTO
  `events` (
    `id`,
    `title`,
    `description`,
    `lodgeMeeting`,
    `price`,
    `startDate`,
    `endDate`
  )
VALUES
  (
    1,
    'Founders Meeting',
    'Annual founders meeting and dinner.',
    1,
    275.00,
    '2026-02-14 18:00:00',
    '2026-02-14 21:00:00'
  ),
  (
    2,
    'Summer Gathering',
    'Open summer gathering with activities.',
    0,
    0.00,
    '2026-06-20 10:00:00',
    '2026-06-20 18:00:00'
  ) ON DUPLICATE KEY
UPDATE
  `title` =
VALUES
  (`title`),
  `description` =
VALUES
  (`description`),
  `lodgeMeeting` =
VALUES
  (`lodgeMeeting`),
  `price` =
VALUES
  (`price`),
  `startDate` =
VALUES
  (`startDate`),
  `endDate` =
VALUES
  (`endDate`);

-- Lodges ↔ Events (predictable state)
DELETE FROM
  `lodges_events`
WHERE
  (lid, eid) IN ((1, 1), (2, 2));

INSERT INTO
  `lodges_events` (`lid`, `eid`)
VALUES
  (1, 1),
  (2, 2);

-- Lodges ↔ Posts (predictable state)
DELETE FROM
  `lodges_posts`
WHERE
  (lid, pid) IN ((1, 1), (2, 2));

INSERT INTO
  `lodges_posts` (`lid`, `pid`)
VALUES
  (1, 1),
  (2, 1),
  (3, 1),
  (1, 2),
  (2, 2),
  (3, 2);

-- Event attendances (RSVP)
DELETE FROM
  `events_attendances`
WHERE
  `uid` IN (1, 2, 3);

INSERT INTO
  `events_attendances` (`uid`, `eid`, `rsvp`)
VALUES
  (1, 1, 1),
  (2, 1, 0),
  (3, 2, 1);

-- Posts
INSERT INTO
  `posts` (`id`, `title`, `description`, `picture`)
VALUES
  (
    1,
    'Welcome to OSVS',
    'This is the first post on our new platform!',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png'
  ),
  (
    2,
    'Upcoming Event',
    'Join us for our annual gathering next month.',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png'
  ) ON DUPLICATE KEY
UPDATE
  `title` =
VALUES
  (`title`),
  `description` =
VALUES
  (`description`),
  `picture` =
VALUES
  (`picture`);

-- Membership payments (yearly) - predictable state for these users/years
DELETE FROM
  `membership_payments`
WHERE
  `uid` IN (1, 2, 3)
  AND `year` IN (2025, 2026);

INSERT INTO
  `membership_payments` (
    `uid`,
    `amount`,
    `year`,
    `status`,
    `provider`,
    `provider_ref`,
    `currency`,
    `invoice_token`,
    `expiresAt`,
    `metadata`
  )
VALUES
  (
    1,
    600.00,
    2026,
    'Paid',
    'Manual',
    'seed-uid1-2026',
    'SEK',
    'inv_seed_uid1_2026',
    '2026-12-31 23:59:59',
    JSON_OBJECT('seed', true)
  ),
  (
    2,
    600.00,
    2026,
    'Pending',
    'Manual',
    'seed-uid2-2026',
    'SEK',
    'inv_seed_uid2_2026',
    '2026-12-31 23:59:59',
    JSON_OBJECT('seed', true)
  ),
  (
    3,
    600.00,
    2026,
    'Paid',
    'Manual',
    'seed-uid3-2026',
    'SEK',
    'inv_seed_uid3_2026',
    '2026-12-31 23:59:59',
    JSON_OBJECT('seed', true)
  );

-- Event payments - predictable state for these users/events
DELETE FROM
  `event_payments`
WHERE
  `uid` IN (1, 2, 3)
  AND `eid` IN (1, 2);

INSERT INTO
  `event_payments` (
    `uid`,
    `eid`,
    `amount`,
    `status`,
    `provider`,
    `provider_ref`,
    `currency`,
    `invoice_token`,
    `expiresAt`,
    `metadata`
  )
VALUES
  (
    1,
    1,
    275.00,
    'Paid',
    'Manual',
    'seed-uid1-eid1',
    'SEK',
    'inv_seed_uid1_eid1',
    '2026-02-14 17:59:59',
    JSON_OBJECT('seed', true)
  ),
  (
    2,
    1,
    275.00,
    'Pending',
    'Manual',
    'seed-uid2-eid1',
    'SEK',
    'inv_seed_uid2_eid1',
    '2026-02-14 17:59:59',
    JSON_OBJECT('seed', true)
  ),
  (
    3,
    2,
    0.00,
    'Paid',
    'Manual',
    'seed-uid3-eid2',
    'SEK',
    'inv_seed_uid3_eid2',
    '2026-06-20 09:59:59',
    JSON_OBJECT('seed', true)
  );

-- =====================================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- =====================================================
SET
  FOREIGN_KEY_CHECKS = 1;