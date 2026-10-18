CREATE TABLE `collection_state` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`active_import_id` text NOT NULL,
	FOREIGN KEY (`active_import_id`) REFERENCES `collection_import`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "collection_state_singleton_check" CHECK("collection_state"."singleton" = 1)
);
--> statement-breakpoint
ALTER TABLE `collection_card` ADD `added_at_exact` text;