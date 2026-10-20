-- Migration 006: add personnummer (civicno) column for Access migration
ALTER TABLE `users`
ADD COLUMN `civicno` VARCHAR(13) NULL AFTER `dateOfBirth`;
