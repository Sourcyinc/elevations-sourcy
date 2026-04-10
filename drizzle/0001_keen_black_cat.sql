CREATE TABLE `ai_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`userMessage` text NOT NULL,
	`aiResponse` text,
	`status` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
	`pendingElements` json,
	`codeFlags` json,
	`professionalDecisions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `ai_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`aiSessionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`elementId` int,
	`fbcSection` varchar(30) NOT NULL,
	`severity` enum('error','warning','info') NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`resolved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `county_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`county` varchar(100) NOT NULL,
	`freeboardFt` float DEFAULT 0,
	`windSpeedMph` int NOT NULL,
	`hvhz` boolean DEFAULT false,
	`floodZones` text,
	`requiredSheets` text,
	`submittalPortalUrl` text,
	`digitalSignatureRequired` boolean DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `county_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fbc_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section` varchar(30) NOT NULL,
	`description` text NOT NULL,
	`category` enum('flood','wind','egress','structural','energy','fire','general') NOT NULL,
	`value` float,
	`unit` varchar(30),
	`condition` text,
	`occupancy` varchar(50),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fbc_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ifc_elements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ifcFileId` int NOT NULL,
	`globalId` varchar(64) NOT NULL,
	`ifcClass` varchar(64) NOT NULL,
	`name` varchar(255),
	`description` text,
	`storey` varchar(255),
	`positionX` float,
	`positionY` float,
	`positionZ` float,
	`width` float,
	`height` float,
	`depth` float,
	`propertySets` json,
	`isGhost` boolean DEFAULT false,
	`aiSessionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ifc_elements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ifc_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`fileSizeBytes` int,
	`parsedAt` timestamp,
	`elementCount` int DEFAULT 0,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ifc_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`memberRole` enum('owner','collaborator') NOT NULL DEFAULT 'collaborator',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`ownerId` int NOT NULL,
	`county` varchar(100),
	`floodZone` varchar(20),
	`bfe` float,
	`hvhz` boolean DEFAULT false,
	`windSpeedMph` int,
	`occupancyType` varchar(20),
	`constructionType` varchar(10),
	`stories` int DEFAULT 1,
	`conditionedAreaSf` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
