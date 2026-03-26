CREATE TABLE `groups_events` (
  `gid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`gid`, `eid`),
  KEY `fk_groups_events_event` (`eid`),
  CONSTRAINT `fk_groups_events_group` FOREIGN KEY (`gid`) REFERENCES `groups` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_groups_events_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE `users_events` (
  `uid` int(11) NOT NULL,
  `eid` int(11) NOT NULL,
  PRIMARY KEY (`uid`, `eid`),
  KEY `fk_users_events_event` (`eid`),
  CONSTRAINT `fk_users_events_user` FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_users_events_event` FOREIGN KEY (`eid`) REFERENCES `events` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

ALTER TABLE `lodges_events`
ADD CONSTRAINT `uq_lodges_events_eid` UNIQUE (`eid`);
