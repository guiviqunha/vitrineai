CREATE TABLE `studio_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_studio_projects_updated` ON `studio_projects` (`updated`);--> statement-breakpoint
CREATE TABLE `studio_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`prompt` text NOT NULL,
	`output` text,
	`error` text,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_studio_runs_project_created` ON `studio_runs` (`project_id`,`created`);--> statement-breakpoint
CREATE TABLE `studio_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
