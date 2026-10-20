-- Migration 007: extend archive enum with 'Avförd' for Access migration
-- (Access contacts.archive = 'removed', labelled "avförda" in the old UI;
-- no existing enum value covers it)
ALTER TABLE `users`
MODIFY COLUMN `archive` ENUM('Avliden', 'Urgången', 'Avförd') NULL DEFAULT NULL;
