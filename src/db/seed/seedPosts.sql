-- =====================================================
-- Optional add-on seed: additional posts
-- Depends only on the baseline rows from seed.sql.
-- =====================================================

INSERT INTO
  `posts` (`id`, `title`, `description`, `picture`, `publicum`)
VALUES
  (
    4,
    'New volunteer opportunities',
    'We are looking for more volunteers to help with upcoming activities.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    5,
    'Community clean up day',
    'Join us this weekend as we work together to clean up our local area.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    6,
    'Monthly member meeting',
    'Our next member meeting will take place at the start of next month.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    7,
    'Thank you to our supporters',
    'We want to thank everyone who continues to support our work and events.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    8,
    'Fundraising update',
    'We are happy to share that our latest fundraising effort was a success.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    9,
    'Local partnership announced',
    'We are proud to begin a new partnership with a local organization.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    10,
    'Summer gathering plans',
    'Planning is now underway for our summer gathering and activities.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    11,
    'New board members',
    'Please welcome the new board members joining us this season.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    12,
    'Support our next project',
    'We are preparing our next community project and welcome all support.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    13,
    'Holiday event reminder',
    'Do not forget about our holiday event coming up later this month.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    14,
    'A message from the team',
    'Our team would like to share a short update with all members and supporters.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    15,
    'Youth program update',
    'Our youth program continues to grow and welcome new participants.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    16,
    'Open house invitation',
    'We invite everyone to visit us during our upcoming open house event.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    17,
    'Charity drive results',
    'Thanks to your help, this year''s charity drive reached more people than ever before.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    18,
    'Volunteer spotlight',
    'This week we would like to recognize one of our dedicated volunteers.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    19,
    'Autumn activities ahead',
    'We have several exciting activities planned for the autumn season.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    20,
    'Looking ahead',
    'We are excited about the months ahead and everything we will achieve together.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    21,
    'Spring fundraiser',
    'Our spring fundraiser is now open and we welcome all support.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    22,
    'Member update',
    'We would like to share a short update with all our members.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    23,
    'New community project',
    'We are excited to begin a new project for the local community.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    24,
    'Event schedule released',
    'The schedule for our upcoming events is now ready to view.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    25,
    'Support needed',
    'We are currently looking for extra support for our next activity.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    26,
    'Thank you everyone',
    'Thank you to everyone who helped make our latest event a success.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    27,
    'New season ahead',
    'A new season is ahead and we have many plans to share with you.',
    'posts/postPlaceholder.png',
    0
  ),
  (
    28,
    'Workshop invitation',
    'Join us for our next workshop and take part in the discussion.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    29,
    'Helping local families',
    'This month we continue our work to support local families in need.',
    'posts/postPlaceholder.png',
    1
  ),
  (
    30,
    'Looking forward together',
    'We are looking forward to another great period together with our community.',
    'posts/postPlaceholder.png',
    0
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
