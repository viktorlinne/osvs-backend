-- Migration 008: legacy password compat columns for Access migration
-- Old site stored SHA-256(password + salt), not Argon2id. On first login after
-- cutover, the auth service verifies against these, upgrades passwordHash to
-- Argon2id, then nulls these out. See osvs-backend/scripts/migration/MIGRATION_PLAN.md.
ALTER TABLE `users`
ADD COLUMN `legacyPasswordHash` VARCHAR(128) NULL AFTER `passwordHash`,
ADD COLUMN `legacyPasswordSalt` VARCHAR(32) NULL AFTER `legacyPasswordHash`;
