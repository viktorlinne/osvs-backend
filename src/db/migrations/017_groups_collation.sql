-- Migration 017: give the group tables the same collation as the rest.
-- 002 and 003 declared `DEFAULT CHARSET=utf8mb4` without COLLATE, and MySQL 8
-- then uses the charset default utf8mb4_0900_ai_ci (not the database default),
-- so `groups`.`name`/`description` compare differently from every other text
-- column (utf8mb4_general_ci) and a future join or UNION on them would fail
-- with "Illegal mix of collations". The junction tables only hold integers;
-- their table default is aligned so new columns get general_ci.
-- No data change (utf8mb4 -> utf8mb4); `groups` is small (one row per group).
ALTER TABLE `groups`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `users_groups` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `groups_events` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `users_events` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
