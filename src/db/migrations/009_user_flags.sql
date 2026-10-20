-- Migration 009: per-user flags managed by Admin/Editor
-- feeExempt (OSVS-27, "Befriad från årsavgift"): skip the user in the automatic
--   yearly membership payment job. Existing payments are never touched.
-- standingList (OSVS-28, "Ständiga listan"): when an event is created, prefill
--   an RSVP "going" (and food booking when the event has food) for the user if
--   they are in the event's audience. No backfill of existing events.
ALTER TABLE `users`
ADD COLUMN `feeExempt` TINYINT(1) NOT NULL DEFAULT 0 AFTER `accommodationAvailable`,
ADD COLUMN `standingList` TINYINT(1) NOT NULL DEFAULT 0 AFTER `feeExempt`;
