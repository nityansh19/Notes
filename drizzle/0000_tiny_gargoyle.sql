CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`item_id` text,
	`title` text NOT NULL,
	`action` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_owner_created` ON `activity` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`item_id` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_owner` ON `attachments` (`owner`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_collections_owner` ON `collections` (`owner`);--> statement-breakpoint
CREATE TABLE `item_tags` (
	`item_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`item_id`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`markdown` text DEFAULT '' NOT NULL,
	`collection_id` text,
	`project_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	`favorite` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_owner_status` ON `items` (`owner`,`status`);--> statement-breakpoint
CREATE INDEX `idx_items_owner_collection` ON `items` (`owner`,`collection_id`);--> statement-breakpoint
CREATE TABLE `links` (
	`source` text NOT NULL,
	`target` text NOT NULL,
	PRIMARY KEY(`source`, `target`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tags_owner_name` ON `tags` (`owner`,`name`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`owner` text NOT NULL,
	`snapshot` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_versions_item_owner` ON `versions` (`item_id`,`owner`);