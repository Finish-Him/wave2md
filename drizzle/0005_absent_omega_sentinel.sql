CREATE TABLE `quick_transcriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`audioUrl` text NOT NULL,
	`audioFilename` varchar(255) NOT NULL,
	`transcription` text NOT NULL,
	`language` varchar(10),
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quick_transcriptions_id` PRIMARY KEY(`id`)
);
