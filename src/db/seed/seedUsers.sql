-- =====================================================
-- Additional Users (20 more)
-- =====================================================
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
        8,
        'anders.nilsson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Anders',
        'Nilsson',
        '1981-04-12',
        'Elektriker',
        NULL,
        '0707000008',
        NULL,
        'Karlskrona',
        'Drottninggatan 12',
        '37131',
        '',
        1
    ),
    (
        9,
        'lars.svensson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Lars',
        'Svensson',
        '1975-09-03',
        'Snickare',
        NULL,
        '0707000009',
        NULL,
        'Helsingborg',
        'Storgatan 8',
        '25223',
        '',
        0
    ),
    (
        10,
        'erik.johansson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Erik',
        'Johansson',
        '1988-11-21',
        'Lärare',
        NULL,
        '0707000010',
        NULL,
        'Ängelholm',
        'Skolgatan 5',
        '26231',
        '',
        0
    ),
    (
        11,
        'magnus.pettersson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Magnus',
        'Pettersson',
        '1969-06-15',
        'Ingenjör',
        NULL,
        '0707000011',
        NULL,
        'Göteborg',
        'Linnégatan 22',
        '41304',
        '',
        1
    ),
    (
        12,
        'per.andersson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Per',
        'Andersson',
        '1990-02-10',
        'Polis',
        NULL,
        '0707000012',
        NULL,
        'Halmstad',
        'Västra vägen 14',
        '30244',
        '',
        0
    ),
    (
        13,
        'daniel.karlsson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Daniel',
        'Karlsson',
        '1984-07-07',
        'Säljare',
        NULL,
        '0707000013',
        NULL,
        'Karlskrona',
        'Parkgatan 7',
        '37140',
        '',
        0
    ),
    (
        14,
        'martin.larsson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Martin',
        'Larsson',
        '1978-12-01',
        'Projektledare',
        NULL,
        '0707000014',
        NULL,
        'Helsingborg',
        'Södra Stenbocksgatan 44',
        '25247',
        '',
        1
    ),
    (
        15,
        'jonas.eriksson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Jonas',
        'Eriksson',
        '1986-03-18',
        'Ekonom',
        NULL,
        '0707000015',
        NULL,
        'Ängelholm',
        'Åsbogatan 19',
        '26251',
        '',
        0
    ),
    (
        16,
        'henrik.gustafsson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Henrik',
        'Gustafsson',
        '1973-08-29',
        'Jurist',
        NULL,
        '0707000016',
        NULL,
        'Göteborg',
        'Avenyn 33',
        '41136',
        '',
        0
    ),
    (
        17,
        'oskar.lindberg@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Oskar',
        'Lindberg',
        '1992-01-25',
        'Kock',
        NULL,
        '0707000017',
        NULL,
        'Halmstad',
        'Hamngatan 3',
        '30243',
        '',
        1
    ),
    (
        18,
        'niklas.bergstrom@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Niklas',
        'Bergström',
        '1980-05-14',
        'Företagare',
        NULL,
        '0707000018',
        NULL,
        'Karlskrona',
        'Borgmästaregatan 9',
        '37134',
        '',
        0
    ),
    (
        19,
        'emil.holm@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Emil',
        'Holm',
        '1994-10-30',
        'Systemutvecklare',
        NULL,
        '0707000019',
        NULL,
        'Helsingborg',
        'Karlsgatan 17',
        '25224',
        '',
        1
    ),
    (
        20,
        'patrik.nordin@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Patrik',
        'Nordin',
        '1977-04-04',
        'Läkare',
        NULL,
        '0707000020',
        NULL,
        'Ängelholm',
        'Nybrovägen 11',
        '26263',
        '',
        0
    ),
    (
        21,
        'tobias.wikstrom@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Tobias',
        'Wikström',
        '1983-09-19',
        'Brandman',
        NULL,
        '0707000021',
        NULL,
        'Göteborg',
        'Redbergsvägen 20',
        '41665',
        '',
        1
    ),
    (
        22,
        'robin.eklund@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Robin',
        'Eklund',
        '1991-06-11',
        'Elektronikingenjör',
        NULL,
        '0707000022',
        NULL,
        'Halmstad',
        'Brogatan 16',
        '30242',
        '',
        0
    ),
    (
        23,
        'christian.forsberg@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Christian',
        'Forsberg',
        '1972-01-08',
        'Revisor',
        NULL,
        '0707000023',
        NULL,
        'Karlskrona',
        'Norra Kungsgatan 28',
        '37133',
        '',
        0
    ),
    (
        24,
        'mikael.sandberg@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Mikael',
        'Sandberg',
        '1985-02-27',
        'Logistiker',
        NULL,
        '0707000024',
        NULL,
        'Helsingborg',
        'Järnvägsgatan 6',
        '25224',
        '',
        1
    ),
    (
        25,
        'stefan.axelsson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Stefan',
        'Axelsson',
        '1968-11-05',
        'Fastighetsförvaltare',
        NULL,
        '0707000025',
        NULL,
        'Ängelholm',
        'Villagatan 13',
        '26237',
        '',
        0
    ),
    (
        26,
        'bjorn.mattsson@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Björn',
        'Mattsson',
        '1979-07-23',
        'Mekaniker',
        NULL,
        '0707000026',
        NULL,
        'Göteborg',
        'Östra Hamngatan 41',
        '41110',
        '',
        1
    ),
    (
        27,
        'anton.hedlund@example.com',
        '$argon2id$v=19$m=65536,t=3,p=1$fb9hqs9kIy2ak8yk8i8uSA$ef0butA8uW/UCq5Qo7RPNg1DyKu+6VNCjMlP0fzfFeU',
        NULL,
        'Anton',
        'Hedlund',
        '1996-12-14',
        'Studerande',
        NULL,
        '0707000027',
        NULL,
        'Halmstad',
        'Slottsgatan 25',
        '30242',
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

-- =====================================================
-- Additional Users ↔ Roles
-- =====================================================
INSERT INTO
    `users_roles` (`uid`, `rid`)
VALUES
    (8, 3),
    (9, 3),
    (10, 2),
    (10, 3),
    (11, 1),
    (11, 2),
    (11, 3),
    (12, 3),
    (13, 3),
    (14, 2),
    (14, 3),
    (15, 3),
    (16, 1),
    (16, 2),
    (16, 3),
    (17, 3),
    (18, 2),
    (18, 3),
    (19, 3),
    (20, 1),
    (20, 2),
    (20, 3),
    (21, 3),
    (22, 2),
    (22, 3),
    (23, 3),
    (24, 3),
    (25, 2),
    (25, 3),
    (26, 3),
    (27, 3);

-- =====================================================
-- Additional Users ↔ Achievements
-- =====================================================
INSERT INTO
    `users_achievements` (`uid`, `aid`, `awardedAt`)
VALUES
    (8, 1, '2025-12-01 10:00:00'),
    (9, 1, '2025-12-01 10:00:00'),
    (10, 1, '2025-12-01 10:00:00'),
    (11, 2, '2025-12-01 10:00:00'),
    (12, 1, '2025-12-01 10:00:00'),
    (13, 3, '2025-12-01 10:00:00'),
    (14, 2, '2025-12-01 10:00:00'),
    (15, 1, '2025-12-01 10:00:00'),
    (16, 4, '2025-12-01 10:00:00'),
    (17, 1, '2025-12-01 10:00:00'),
    (18, 2, '2025-12-01 10:00:00'),
    (19, 1, '2025-12-01 10:00:00'),
    (20, 5, '2025-12-01 10:00:00'),
    (21, 2, '2025-12-01 10:00:00'),
    (22, 1, '2025-12-01 10:00:00'),
    (23, 3, '2025-12-01 10:00:00'),
    (24, 1, '2025-12-01 10:00:00'),
    (25, 2, '2025-12-01 10:00:00'),
    (26, 1, '2025-12-01 10:00:00'),
    (27, 1, '2025-12-01 10:00:00');

-- =====================================================
-- Additional Users ↔ Officials
-- =====================================================
INSERT INTO
    `users_officials` (`uid`, `oid`, `appointedAt`, `unAppointedAt`)
VALUES
    (8, 8, '2025-12-01 10:00:00', NULL),
    (9, 9, '2025-12-01 10:00:00', NULL),
    (10, 10, '2025-12-01 10:00:00', NULL),
    (11, 11, '2025-12-01 10:00:00', NULL),
    (12, 12, '2025-12-01 10:00:00', NULL),
    (13, 13, '2025-12-01 10:00:00', NULL),
    (14, 14, '2025-12-01 10:00:00', NULL),
    (15, 15, '2025-12-01 10:00:00', NULL),
    (16, 16, '2025-12-01 10:00:00', NULL),
    (17, 17, '2025-12-01 10:00:00', NULL),
    (18, 18, '2025-12-01 10:00:00', NULL),
    (19, 19, '2025-12-01 10:00:00', NULL),
    (20, 20, '2025-12-01 10:00:00', NULL),
    (21, 21, '2025-12-01 10:00:00', NULL),
    (22, 22, '2025-12-01 10:00:00', NULL),
    (23, 23, '2025-12-01 10:00:00', NULL),
    (24, 24, '2025-12-01 10:00:00', NULL),
    (25, 25, '2025-12-01 10:00:00', NULL),
    (26, 26, '2025-12-01 10:00:00', NULL),
    (27, 27, '2025-12-01 10:00:00', NULL);

-- =====================================================
-- Additional Users ↔ Lodges
-- =====================================================
INSERT INTO
    `users_lodges` (`uid`, `lid`)
VALUES
    (8, 1),
    (9, 2),
    (10, 3),
    (11, 4),
    (12, 5),
    (13, 1),
    (14, 2),
    (15, 3),
    (16, 4),
    (17, 5),
    (18, 1),
    (19, 2),
    (20, 3),
    (21, 4),
    (22, 5),
    (23, 1),
    (24, 2),
    (25, 3),
    (26, 4),
    (27, 5);

-- =====================================================
-- Additional Users ↔ Allergies
-- =====================================================
INSERT INTO
    `users_allergies` (`uid`, `alid`)
VALUES
    (8, 8),
    (9, 1),
    (10, 2),
    (11, 3),
    (12, 4),
    (13, 5),
    (14, 6),
    (15, 7),
    (16, 8),
    (17, 1),
    (18, 2),
    (19, 3),
    (20, 4),
    (21, 5),
    (22, 6),
    (23, 7),
    (24, 8),
    (25, 1),
    (26, 2),
    (27, 3);