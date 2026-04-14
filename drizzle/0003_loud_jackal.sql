CREATE TABLE `bim_scenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sceneGraphUrl` text,
	`sceneGraphKey` varchar(512),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bim_scenes_id` PRIMARY KEY(`id`),
	CONSTRAINT `bim_scenes_projectId_unique` UNIQUE(`projectId`)
);
