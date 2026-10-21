-- Migration 011: an event can have several lodges in its audience.
-- 003 added UNIQUE (eid) on lodges_events, which limited every event to one
-- lodge (and made INSERT IGNORE silently drop the extra lodges). The composite
-- primary key (lid, eid) stays, and the plain index `fk_lodges_events_event`
-- (eid) from 001 keeps backing the foreign key.
ALTER TABLE `lodges_events`
DROP INDEX `uq_lodges_events_eid`;
