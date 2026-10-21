CREATE TABLE `project_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`category` text NOT NULL,
	`version_label` text DEFAULT '' NOT NULL,
	`sha256` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_files_object_key_idx` ON `project_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `project_files_owner_project_idx` ON `project_files` (`owner_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `project_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_revisions_project_version_idx` ON `project_revisions` (`project_id`,`version`);--> statement-breakpoint
CREATE INDEX `project_revisions_owner_project_idx` ON `project_revisions` (`owner_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`last_mutation_id` text NOT NULL,
	`lifecycle` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner_updated_idx` ON `projects` (`owner_id`,`updated_at`);