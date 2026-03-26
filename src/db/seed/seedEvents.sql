-- =====================================================
-- Optional add-on seed: additional events
-- Depends only on the baseline rows from seed.sql.
-- =====================================================

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
    5,
    'Founders Meeting',
    'Annual founders meeting and dinner.',
    1,
    1,
    275.00,
    '2026-03-14 18:00:00',
    '2026-03-14 21:00:00'
  ),
  (
    6,
    'Spring Gathering',
    'Open spring gathering with activities.',
    0,
    0,
    0.00,
    '2026-04-18 10:00:00',
    '2026-04-18 17:00:00'
  ),
  (
    7,
    'Lodge Dinner',
    'Evening lodge dinner with guest speakers.',
    0,
    1,
    180.00,
    '2026-05-09 18:30:00',
    '2026-05-09 22:00:00'
  ),
  (
    8,
    'Board Meeting',
    'Quarterly board meeting and discussion.',
    1,
    0,
    0.00,
    '2026-05-21 17:30:00',
    '2026-05-21 19:30:00'
  ),
  (
    9,
    'Summer Gathering',
    'Open summer gathering with activities.',
    0,
    0,
    0.00,
    '2026-06-13 11:00:00',
    '2026-06-13 18:00:00'
  ),
  (
    10,
    'Charity Dinner',
    'Formal charity dinner with entertainment.',
    0,
    1,
    325.00,
    '2026-09-12 18:00:00',
    '2026-09-12 23:00:00'
  ),
  (
    11,
    'Autumn Meeting',
    'Seasonal lodge meeting and refreshments.',
    1,
    1,
    120.00,
    '2026-10-08 18:00:00',
    '2026-10-08 20:30:00'
  ),
  (
    12,
    'Cultural Evening',
    'Open cultural evening with presentations.',
    0,
    1,
    95.00,
    '2026-10-24 17:00:00',
    '2026-10-24 21:00:00'
  ),
  (
    13,
    'Winter Gathering',
    'Open winter gathering with activities.',
    0,
    0,
    0.00,
    '2026-12-05 10:00:00',
    '2026-12-05 17:00:00'
  ),
  (
    14,
    'Year End Meeting',
    'Closing meeting of the year with dinner.',
    1,
    1,
    210.00,
    '2026-12-18 18:00:00',
    '2026-12-18 22:00:00'
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

INSERT IGNORE INTO
  `lodges_events` (`lid`, `eid`)
VALUES
  (1, 5),
  (1, 8),
  (2, 9),
  (4, 10),
  (5, 11),
  (2, 12),
  (4, 13),
  (5, 14);

INSERT IGNORE INTO
  `groups_events` (`gid`, `eid`)
VALUES
  (2, 5),
  (3, 6),
  (1, 8),
  (2, 9),
  (1, 12),
  (2, 14);

INSERT IGNORE INTO
  `users_events` (`uid`, `eid`)
VALUES
  (6, 5),
  (5, 7),
  (6, 7),
  (7, 7),
  (3, 10),
  (2, 12),
  (1, 14);

INSERT IGNORE INTO
  `events_attendances` (`uid`, `eid`, `rsvp`, `bookFood`, `attended`)
SELECT DISTINCT
  invited.uid,
  invited.eid,
  2,
  0,
  0
FROM (
  SELECT ul.uid, le.eid
  FROM lodges_events le
  JOIN users_lodges ul ON ul.lid = le.lid
  UNION
  SELECT ug.uid, ge.eid
  FROM groups_events ge
  JOIN users_groups ug ON ug.gid = ge.gid
  UNION
  SELECT ue.uid, ue.eid
  FROM users_events ue
) invited
WHERE invited.eid BETWEEN 5 AND 14;

INSERT IGNORE INTO
  `event_payments` (`uid`, `eid`, `amount`, `status`)
SELECT DISTINCT
  invited.uid,
  invited.eid,
  e.price,
  'Pending'
FROM (
  SELECT ul.uid, le.eid
  FROM lodges_events le
  JOIN users_lodges ul ON ul.lid = le.lid
  UNION
  SELECT ug.uid, ge.eid
  FROM groups_events ge
  JOIN users_groups ug ON ug.gid = ge.gid
  UNION
  SELECT ue.uid, ue.eid
  FROM users_events ue
) invited
JOIN events e ON e.id = invited.eid
WHERE invited.eid BETWEEN 5 AND 14;
