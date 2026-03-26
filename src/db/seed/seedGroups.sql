-- =====================================================
-- Optional add-on seed: additional groups
-- Depends only on the baseline rows from seed.sql.
-- =====================================================

INSERT INTO
  `groups` (`id`, `name`, `description`)
VALUES
  (4, 'Ceremonigruppen', 'Grupp for planering och genomforande av ceremonier.'),
  (5, 'Resegruppen', 'Grupp for resor och samordning mellan logerna.'),
  (6, 'Traditionsgruppen', 'Grupp som ansvarar for traditioner och program.') ON DUPLICATE KEY
UPDATE
  `name` =
VALUES
  (`name`),
  `description` =
VALUES
  (`description`);

INSERT IGNORE INTO
  `users_groups` (`uid`, `gid`)
VALUES
  (1, 4),
  (3, 4),
  (5, 4),
  (7, 4),
  (2, 5),
  (4, 5),
  (6, 5),
  (1, 6),
  (2, 6),
  (3, 6),
  (6, 6);
