-- Migration 016: soft delete for events, posts and groups (decision D4,
-- 2026-10-22: nothing is hard deleted). "Ta bort" in the app now sets
-- deletedAt/deletedBy instead of deleting the row, so attendances, payments
-- (incl. paid ones and their log), group memberships and post pictures stay in
-- the database and can be restored by clearing deletedAt. Every read in the
-- repositories filters `deletedAt IS NULL`; the index keeps those filters and
-- the event lists (ORDER BY startDate) cheap.
ALTER TABLE `events`
  ADD COLUMN `deletedAt` datetime DEFAULT NULL,
  ADD COLUMN `deletedBy` int(11) DEFAULT NULL,
  ADD KEY `idx_events_deletedAt_startDate` (`deletedAt`, `startDate`);

ALTER TABLE `posts`
  ADD COLUMN `deletedAt` datetime DEFAULT NULL,
  ADD COLUMN `deletedBy` int(11) DEFAULT NULL,
  ADD KEY `idx_posts_deletedAt` (`deletedAt`);

ALTER TABLE `groups`
  ADD COLUMN `deletedAt` datetime DEFAULT NULL,
  ADD COLUMN `deletedBy` int(11) DEFAULT NULL,
  ADD KEY `idx_groups_deletedAt` (`deletedAt`);
