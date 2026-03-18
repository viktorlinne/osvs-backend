CREATE TABLE `groups` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `description` text,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `users_groups` (
    `uid` int(11) NOT NULL,
    `gid` int(11) NOT NULL,
    PRIMARY KEY (`uid`, `gid`),
    FOREIGN KEY (`uid`) REFERENCES `users` (`matrikelnummer`) ON DELETE CASCADE,
    FOREIGN KEY (`gid`) REFERENCES `groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
