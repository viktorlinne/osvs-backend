INSERT INTO `groups` (id, name, description) VALUES
(1, 'Admins', 'Administrators with full access to the system.'),
(2, 'Fastighetsföreningen Orion', 'Fastighetsförening för logen Orion'),
(3, 'Fastighetsföreningen Stamlogen', 'Fastighetsförening för logen Stamlogen');

INSERT INTO `users_groups` (uid, gid) VALUES
(1, 1),
(4, 1),
(5, 1),
(6, 1);