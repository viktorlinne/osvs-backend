-- =====================================================
-- Lookup / reference data
-- =====================================================
-- Only real reference rows the app needs to function: roles, achievements
-- (grades/medals), officials (titles 1-44, incl. the deputy titles), allergies and
-- lodges (incl. the Orion/Stamlogen Damklubbar 6-7).
--
-- No members, posts, events, payments, documents or other demo content
-- belongs here. Development, staging and production databases get their
-- content from the Access loader (`npm run migrate:legacy`, see
-- scripts/migration/MIGRATION_PLAN.md).
--
-- Every statement is an idempotent upsert, so this file can be re-run after
-- `npm run migrate` and before or after the loader. The loader's
-- --seed-lookups option applies the same INSERTs (selectLookupSeedStatements
-- in scripts/migration/lib/apply.ts), so keep one INSERT per lookup table and
-- add nothing else (test/migration/transformApply.test.ts enforces this).

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
  (27, 'Kurator'),
  (28, 'Revisor'),
  (29, 'Logefotograf'),
  (30, 'Valberedning'),
  (31, 'Biträdande Klubbmästare'),
  (32, 'Biträdande Ljudtekniker'),
  (33, 'Biträdande Webbredaktör'),
  (34, 'Biträdande Instruktionsbroder'),
  (35, 'Biträdande Orator'),
  (36, 'Biträdande Ceremonimästare'),
  (37, 'Biträdande Logefotograf'),
  (38, 'Biträdande Kurator'),
  (39, 'Biträdande Ledande Broder'),
  (40, 'Biträdande Visdomens Broder'),
  (41, 'Biträdande Kanslisekreterare'),
  (42, 'Biträdande Logeskattmästare'),
  (43, 'Biträdande Webmaster'),
  (44, 'Ställföreträdande Ordensmästare') ON DUPLICATE KEY
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
    '/karlskrona.webp'
  ),
  (
    2,
    'Stella Polaris',
    'Helsingborg',
    'Vid släktmiddag i Karlskrona 1930 träffade disponent Ewald Stridh t.f.Styrande Recorn Ernst Johansson och där framförde tanke om kamratförbund i Helsingborg vilket senare välkomnades av bröderna i Karlskrona. Den handlingskraftige Bernhard Rosenlindh knöts till kretsen. Efter målmedvetet arbete gavs så framgång och 6 bröder kunde proformarecipiera i Karlskrona. Instiftning, där 40 blivande bröder deltog, avhölls 1931.Idag är vi ca 70 Bröder i varierande grader.',
    'stellapolaris@osvs.se',
    '/helsingborg.webp'
  ),
  (
    3,
    'Regulus',
    'Ängelholm',
    'Inpulser till logens bildande kom från broderlogen Helsingborg. Den 27 juli 1932 anordnades ett sammanträffande med intresserade personer i Ängelholm och Helsingborg för information. I januari 1933 hölls invigning i Odd Fellows lokaler i närvaro av Stora Rådets medlemmar. En ny länk i Ordenskedjan bildas. Logens SR var Albin Nilsson. Logen har nu 40 Bröder och c:a 10 Damer.',
    'regulus@osvs.se',
    '/angelholm.webp'
  ),
  (
    4,
    'Orion',
    'Göteborg',
    'Logen Orion instiftades den 26 februari 1943. Logens tillkomst föregicks av några sammanträden under senare delen av 1942 mellan från Karlskrona till Nya Varvet flyttad militär personal, och personer i Göteborg, som gjort sin värnplikt i Karlskrona. Till Logens Styrande Recor valdes Löjtnant Gustaf Idh. Från 1955 egen fastighet där logelokalen är förlagd. Idag har logen 180 medlemmar och 80 i Damklubben.',
    'orion@osvs.se',
    '/goteborg.webp'
  ),
  (
    5,
    'Capella',
    'Halmstad',
    'Enligt ett protokoll från Förtroenderådets sammanträde i maj 1974 framgår det, att det gamla önskemålet, att Ordenssamfundet VS finge flera loger än nuvarande fyra, tycktes gå i uppfyllelse. Det gäller en loge i Halmstad, dit många av bröderna från både Göteborg och Ängelholm flyttat. Logen Capella instiftades således den 28 november 1975. Idag har logen 68 Bröder och 25 i Damklubben.',
    'capella@osvs.se',
    '/halmstad.webp'
  ),
  -- Damklubbar (Access lodge codes OrionDK / StamlogenDK), added for the data
  -- migration (OPEN-QUESTIONS.md §2). Until the client supplies their own text
  -- they copy city, description, e-mail and picture from Orion (4) and
  -- Stamlogen (1); edit them in the app afterwards (decision 2026-10-22).
  -- Re-running this seed overwrites such edits, like for every lodge row.
  (
    6,
    'Orion Damklubb',
    'Göteborg',
    'Logen Orion instiftades den 26 februari 1943. Logens tillkomst föregicks av några sammanträden under senare delen av 1942 mellan från Karlskrona till Nya Varvet flyttad militär personal, och personer i Göteborg, som gjort sin värnplikt i Karlskrona. Till Logens Styrande Recor valdes Löjtnant Gustaf Idh. Från 1955 egen fastighet där logelokalen är förlagd. Idag har logen 180 medlemmar och 80 i Damklubben.',
    'orion@osvs.se',
    '/goteborg.webp'
  ),
  (
    7,
    'Stamlogen Damklubb',
    'Karlskrona',
    'Stamlogens Fastighetsförening bildades och verkade i sju år innan man vid ett logemöte 1939 meddelade förvärv av Johanneskapellet och året därefter bildades V - Sexans första Damklubben. Idag har Stamogen 200 medlemmar varav där är 30 i Damklubben.',
    'stamlogen@osvs.se',
    '/karlskrona.webp'
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
