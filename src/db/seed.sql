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

-- Allergies
INSERT INTO
  `allergies` (`id`, `title`)
VALUES
  (1, 'Gluten'),
  (2, 'Laktos'),
  (3, 'Ägg'),
  (4, 'Fisk'),
  (5, 'Skaldjur'),
  (6, 'Nötter'),
  (7, 'Soja'),
  (8, 'Sädeskorn') ON DUPLICATE KEY
UPDATE
  `title` =
VALUES
  (`title`);

-- Posts
INSERT INTO
  `posts` (
    `id`,
    `title`,
    `description`,
    `picture`,
    `publicum`
  )
VALUES
  (
    1,
    'Welcome to OSVS',
    'This is the first post on our new platform!',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png',
    0
  ),
  (
    2,
    'Upcoming Event',
    'Join us for our annual gathering next month.',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png',
    0
  ),
  (
    3,
    'This years charitable cause',
    'Our charitable cause this year is to support local food banks.',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/posts/postPlaceholder.png',
    1
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
  (`picture`),
  `publicum` =
VALUES
  (`publicum`);

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
    `matrikelnummer`,
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
    'viktor.linne@gmail.com',
    '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
    NULL,
    'Viktor',
    'Linné',
    '2002-01-18',
    'Webb Utvecklare',
    NULL,
    '0705788520',
    NULL,
    'Vallda',
    'Motionsvägen 74',
    '43490',
    '',
    1
  ),
  (
    2,
    'member@example.com',
    '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
    NULL,
    'Member',
    'Example',
    '1900-01-01',
    'Testare',
    NULL,
    '0707070707',
    NULL,
    'Stockholm',
    'Storgatan 1',
    '22233',
    '',
    0
  ),
  (
    3,
    'editor@example.com',
    '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
    NULL,
    'Editor',
    'Example',
    '1900-01-01',
    'Testare',
    NULL,
    '0707070707',
    NULL,
    'Stockholm',
    'Storgatan 1',
    '22233',
    '',
    0
  ),
  (
    4,
    'johan@bankel.com',
    '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
    NULL,
    'Johan',
    'Bankel',
    '1900-01-01',
    'Arbete',
    NULL,
    '0707070707',
    NULL,
    'Stockholm',
    'Storgatan 1',
    '22233',
    '',
    0
  ),
  (
    5,
    'joja@me.com',
    '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
    NULL,
    'Johan',
    'Jakobsson',
    '1900-01-01',
    'Arbete',
    NULL,
    '0707070707',
    NULL,
    'Stockholm',
    'Storgatan 1',
    '22233',
    '',
    0
  ),
  (
    6,
    'fredrik.wassberg@xerab.se',
    '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
    NULL,
    'Fredrik',
    'Wassberg',
    '1900-01-01',
    'Arbete',
    NULL,
    '0707070707',
    NULL,
    'Fjärås',
    'Kornvägen 22',
    '43973',
    '',
    0
  ),
(
  7,
  'admin@example.com',
  '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
  NULL,
  'Admin',
  'Example',
  '1900-01-01',
  'Testare',
  NULL,
  '0707070707',
  NULL,
  'Stockholm',
  'Storgatan 1',
  '22233',
  '',
  0
) ON DUPLICATE KEY
UPDATE
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

-- Events
INSERT INTO
  `events` (
    `id`,
    `title`,
    `description`,
    `lodgeMeeting`,
    `food`,
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
    1,
    275.00,
    '2026-03-14 18:00:00',
    '2026-03-14 21:00:00'
  ),
  (
    2,
    'Summer Gathering',
    'Open summer gathering with activities.',
    0,
    0,
    0.00,
    '2026-12-20 10:00:00',
    '2026-12-20 18:00:00'
  ),
  (
    3,
    'Winter Gathering',
    'Open winter gathering with activities.',
    0,
    0,
    0.00,
    '2025-12-20 10:00:00',
    '2025-12-20 18:00:00'
  ),
  (
    4,
    'Spring Gathering',
    'Open spring gathering with activities.',
    0,
    0,
    0.00,
    '2026-03-20 10:00:00',
    '2026-03-20 18:00:00'
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
  `food` =
VALUES
  (`food`),
  `price` =
VALUES
  (`price`),
  `startDate` =
VALUES
  (`startDate`),
  `endDate` =
VALUES
  (`endDate`);

INSERT INTO
  `revisions` (`id`, `lid`, `year`, `title`, `picture`)
VALUES
  (
    1,
    1,
    '2026-01-01',
    'Stamlogen Revision',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/revisions/revisionPlaceholder.pdf'
  ),
  (
    2,
    2,
    '2026-01-01',
    'Stella Polaris Revision',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/revisions/revisionPlaceholder.pdf'
  ),
  (
    3,
    3,
    '2026-01-01',
    'Regulus Revision',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/revisions/revisionPlaceholder.pdf'
  ),
  (
    4,
    4,
    '2026-01-01',
    'Orion Revision',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/revisions/revisionPlaceholder.pdf'
  ) ON DUPLICATE KEY
UPDATE
  `year` =
VALUES
  (`year`),
  `title` =
VALUES
  (`title`),
  `picture` =
VALUES
  (`picture`);

INSERT INTO
  `documents` (`id`, `title`, `picture`)
VALUES
  (
    1,
    'Stamlogen Stadgar',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/documents/documentPlaceholder.pdf'
  ),
  (
    2,
    'Stella Polaris Stadgar',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/documents/documentPlaceholder.pdf'
  ),
  (
    3,
    'Regulus Stadgar',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/documents/documentPlaceholder.pdf'
  ),
  (
    4,
    'Orion Stadgar',
    'https://kmxmlfhkojdbuoktavul.supabase.co/storage/v1/object/public/documents/documentPlaceholder.pdf'
  ) ON DUPLICATE KEY
UPDATE
  `title` =
VALUES
  (`title`),
  `picture` =
VALUES
  (`picture`);

-- Users ↔ Roles (predictable state)
INSERT INTO
  `users_roles` (`uid`, `rid`)
VALUES
  (1, 1),
  (1, 2),
  (1, 3),
  (2, 3),
  (3, 2),
  (3, 3),
  (4, 1),
  (4, 2),
  (4, 3),
  (5, 1),
  (5, 2),
  (5, 3),
  (6, 1),
  (6, 2),
  (6, 3),
  (7, 1),
  (7, 2),
  (7, 3);


-- Users ↔ Achievements
INSERT INTO
  `users_achievements` (`uid`, `aid`, `awardedAt`)
VALUES
  (1, 1, '2025-12-01 10:00:00'),
  (2, 1, '2025-12-01 10:00:00'),
  (3, 1, '2025-12-01 10:00:00'),
  (4, 1, '2025-12-01 10:00:00'),
  (5, 1, '2025-12-01 10:00:00'),
  (6, 1, '2025-12-01 10:00:00'),
  (7, 1, '2025-12-01 10:00:00');

-- Users ↔ Officials
INSERT INTO
  `users_officials` (`uid`, `oid`, `appointedAt`, `unAppointedAt`)
VALUES
  (1, 1, '2025-01-01 10:00:00', NULL),
  (2, 2, '2025-12-01 10:00:00', NULL),
  (3, 3, '2025-12-01 10:00:00', NULL),
  (4, 4, '2025-12-01 10:00:00', NULL),
  (5, 5, '2025-12-01 10:00:00', NULL),
  (6, 6, '2025-12-01 10:00:00', NULL),
  (7, 7, '2025-12-01 10:00:00', NULL);

-- Users ↔ Lodges
INSERT INTO
  `users_lodges` (`uid`, `lid`)
VALUES
  (1, 1),
  (2, 2),
  (3, 4),
  (4, 4),
  (5, 5),
  (6, 5),
  (7, 5);

-- Users ↔ Allergies
INSERT INTO
  `users_allergies` (`uid`, `alid`)
VALUES
  (1, 1),
  (2, 2),
  (3, 3),
  (4, 4),
  (5, 5),
  (6, 6),
  (7, 7);

-- Lodges ↔ Events (predictable state)
INSERT INTO
  `lodges_events` (`lid`, `eid`)
VALUES
  (1, 1),
  (2, 2);

-- Lodges ↔ Posts (predictable state)
INSERT INTO
  `lodges_posts` (`lid`, `pid`)
VALUES
  (1, 1),
  (2, 1),
  (3, 1),
  (1, 2),
  (2, 2),
  (3, 2);

-- =====================================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- =====================================================
