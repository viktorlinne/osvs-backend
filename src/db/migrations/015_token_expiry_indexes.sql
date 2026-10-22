-- Migration 015: indexes for the daily token cleanup (src/scripts/cron_runner.ts).
-- `DELETE ... WHERE expiresAt < NOW()` on refresh_tokens and revoked_tokens
-- scanned (and, under REPEATABLE READ, locked) the whole table, blocking
-- logins and session renewals that insert into it while the cleanup ran.
-- Every refresh rotation adds a row that stays until it expires (30 days), so
-- refresh_tokens is the table that grows. password_action_tokens already has
-- idx_password_action_tokens_expiresAt (005). Index-only change, no data change.
ALTER TABLE `refresh_tokens`
  ADD KEY `idx_refresh_tokens_expiresAt` (`expiresAt`);

ALTER TABLE `revoked_tokens`
  ADD KEY `idx_revoked_tokens_expiresAt` (`expiresAt`);
