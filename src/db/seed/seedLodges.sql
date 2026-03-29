-- =====================================================
-- Optional add-on seed: additional lodges
-- Depends only on the baseline rows from seed.sql.
-- =====================================================

INSERT INTO
  `lodges` (`id`, `name`, `city`, `description`, `email`, `picture`)
VALUES
  (6, 'Stamlogen Damernas', 'Karlkrona', 'Stamlogens damer', 'stamlogen@osvs.se', 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/karlskrona.webp'),
  (7, 'Stella Polaris Damernas', 'Helsingborg', 'Stella Polaris damer', 'stellapolaris@osvs.se', 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/helsingborg.webp'),
  (8, 'Regulus Damernas', 'Ängelholm', 'Regulus damer', 'regulus@osvs.se', 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/angelholm.webp'),
  (9, 'Orion Damernas', 'Göteborg', 'Orions damer', 'orion@osvs.se', 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/goteborg.webp'),
  (10, 'Capella Damernas', 'Halmstad', 'Capellas damer', 'capella@osvs.se', 'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/static/halmstad.webp') ON DUPLICATE KEY
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