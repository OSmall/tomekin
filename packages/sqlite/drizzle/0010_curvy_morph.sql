CREATE TABLE `scryfall_migration_application` (
	`id` text PRIMARY KEY NOT NULL,
	`migration_id` text NOT NULL,
	`oracle_import_id` text NOT NULL,
	`old_printing_id` text NOT NULL,
	`new_printing_id` text,
	`old_identity_id` text,
	`new_identity_id` text,
	`applied_at` integer NOT NULL,
	FOREIGN KEY (`migration_id`) REFERENCES `scryfall_migration_evidence`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`oracle_import_id`) REFERENCES `scryfall_bulk_data_import`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scryfall_migration_application_unique` ON `scryfall_migration_application` (`migration_id`,`oracle_import_id`);--> statement-breakpoint
CREATE TABLE `scryfall_migration_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`old_printing_id` text NOT NULL,
	`evidence_json` text NOT NULL,
	`source_uri` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scryfall_migration_old_printing` ON `scryfall_migration_evidence` (`old_printing_id`);