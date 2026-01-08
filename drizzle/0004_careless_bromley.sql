CREATE TABLE `project_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`shareToken` varchar(64) NOT NULL,
	`isPublic` int NOT NULL DEFAULT 1,
	`password` text,
	`permissions` enum('view','download') NOT NULL DEFAULT 'view',
	`expiresAt` timestamp,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastAccessedAt` timestamp,
	CONSTRAINT `project_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_shares_shareToken_unique` UNIQUE(`shareToken`)
);
