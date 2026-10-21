-- Migration 012: settle the third archive value on 'Avförd'.
-- An early version of 007 added 'Borttagen'; 007 was later changed to
-- 'Avförd' (the old site's word "avförda"), but databases that had already
-- run the early 007 still have 'Borttagen'. Widen, convert, narrow — a no-op
-- on databases that ran the final 007.
ALTER TABLE `users`
MODIFY COLUMN `archive` ENUM('Avliden', 'Urgången', 'Borttagen', 'Avförd') NULL DEFAULT NULL;

UPDATE `users` SET `archive` = 'Avförd' WHERE `archive` = 'Borttagen';

ALTER TABLE `users`
MODIFY COLUMN `archive` ENUM('Avliden', 'Urgången', 'Avförd') NULL DEFAULT NULL;
