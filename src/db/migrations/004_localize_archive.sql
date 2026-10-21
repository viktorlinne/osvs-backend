-- Migration 004: localize the archive enum.
-- (2026-10-22) The table name was qualified as `osvs_dev`.`users`, which failed
-- on databases with another name. The runner tracks migrations by filename
-- only, so databases that already ran 004 are unaffected by this edit.
ALTER TABLE `users`
CHANGE COLUMN `archive` `archive` ENUM('Avliden', 'Urgången') NULL DEFAULT NULL;
