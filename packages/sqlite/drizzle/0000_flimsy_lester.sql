CREATE TABLE `card_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`layout` text DEFAULT 'normal' NOT NULL,
	`mana_cost` text,
	`mana_value` real NOT NULL,
	`type_line` text NOT NULL,
	`oracle_text` text,
	`color_identity` text DEFAULT '' NOT NULL,
	`colors` text,
	`color_indicator` text,
	`produced_mana` text,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`power` text,
	`toughness` text,
	`loyalty` text,
	`defense` text,
	`edhrec_rank` integer,
	`game_changer` integer,
	`source_page_uri` text NOT NULL,
	CONSTRAINT "card_identity_color_identity_check" CHECK("card_identity"."color_identity" IN ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG', 'WUBRG'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_color_identity` ON `card_identity` (`color_identity`);--> statement-breakpoint
CREATE TABLE `card_identity_format_legality` (
	`card_identity_id` text NOT NULL,
	`format` text NOT NULL,
	`legality` text NOT NULL,
	PRIMARY KEY(`card_identity_id`, `format`),
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "card_identity_format_legality_format_check" CHECK(length("card_identity_format_legality"."format") > 0),
	CONSTRAINT "card_identity_format_legality_legality_check" CHECK("card_identity_format_legality"."legality" IN ('legal', 'not_legal', 'banned', 'restricted'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_format_legality_card_identity_id` ON `card_identity_format_legality` (`card_identity_id`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_format_legality_format_legality` ON `card_identity_format_legality` (`format`,`legality`);--> statement-breakpoint
CREATE TABLE `card_identity_part` (
	`card_identity_id` text NOT NULL,
	`part_index` integer NOT NULL,
	`name` text NOT NULL,
	`mana_cost` text,
	`type_line` text,
	`oracle_text` text,
	`colors` text,
	`color_indicator` text,
	`power` text,
	`toughness` text,
	`loyalty` text,
	`defense` text,
	PRIMARY KEY(`card_identity_id`, `part_index`),
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_part_card_identity_id` ON `card_identity_part` (`card_identity_id`);--> statement-breakpoint
CREATE TABLE `card_identity_tag` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`source_page_uri` text NOT NULL,
	CONSTRAINT "card_identity_tag_slug_check" CHECK(length("card_identity_tag"."slug") > 0),
	CONSTRAINT "card_identity_tag_label_check" CHECK(length("card_identity_tag"."label") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_identity_tag_slug_unique` ON `card_identity_tag` (`slug`);--> statement-breakpoint
CREATE TABLE `card_identity_tag_alias` (
	`tag_id` text NOT NULL,
	`alias` text NOT NULL,
	PRIMARY KEY(`tag_id`, `alias`),
	FOREIGN KEY (`tag_id`) REFERENCES `card_identity_tag`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "card_identity_tag_alias_alias_check" CHECK(length("card_identity_tag_alias"."alias") > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_tag_alias_tag_id` ON `card_identity_tag_alias` (`tag_id`);--> statement-breakpoint
CREATE TABLE `card_identity_tag_hierarchy` (
	`parent_tag_id` text NOT NULL,
	`child_tag_id` text NOT NULL,
	PRIMARY KEY(`parent_tag_id`, `child_tag_id`),
	FOREIGN KEY (`parent_tag_id`) REFERENCES `card_identity_tag`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_tag_id`) REFERENCES `card_identity_tag`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_tag_hierarchy_child_tag_id` ON `card_identity_tag_hierarchy` (`child_tag_id`);--> statement-breakpoint
CREATE TABLE `card_identity_tagging` (
	`tag_id` text NOT NULL,
	`card_identity_id` text NOT NULL,
	`weight` text NOT NULL,
	`annotation` text,
	PRIMARY KEY(`tag_id`, `card_identity_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `card_identity_tag`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "card_identity_tagging_weight_check" CHECK("card_identity_tagging"."weight" IN ('very_strong', 'strong', 'median', 'weak'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_tagging_card_identity_id` ON `card_identity_tagging` (`card_identity_id`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_tagging_tag_id` ON `card_identity_tagging` (`tag_id`);--> statement-breakpoint
CREATE TABLE `card_printing` (
	`id` text PRIMARY KEY NOT NULL,
	`card_identity_id` text NOT NULL,
	`layout` text DEFAULT 'standard' NOT NULL,
	`printed_name` text,
	`set_code` text NOT NULL,
	`collector_number` text NOT NULL,
	`finishes_json` text DEFAULT '[]' NOT NULL,
	`language` text NOT NULL,
	`tcgplayer_id` integer,
	`cardmarket_id` integer,
	`source_page_uri` text NOT NULL,
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_printing_card_identity_id` ON `card_printing` (`card_identity_id`);--> statement-breakpoint
CREATE TABLE `card_printing_part` (
	`card_printing_id` text NOT NULL,
	`part_index` integer NOT NULL,
	`printed_name` text,
	`flavor_name` text,
	`printed_type_line` text,
	`printed_text` text,
	`flavor_text` text,
	`artist` text,
	`artist_id` text,
	`illustration_id` text,
	`image_uris_json` text,
	PRIMARY KEY(`card_printing_id`, `part_index`),
	FOREIGN KEY (`card_printing_id`) REFERENCES `card_printing`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_printing_part_card_printing_id` ON `card_printing_part` (`card_printing_id`);--> statement-breakpoint
CREATE TABLE `collection_import` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`imported_at` integer NOT NULL,
	`source_format` text NOT NULL,
	`source_label` text NOT NULL,
	`imported_owned_card_rows` integer DEFAULT 0 NOT NULL,
	`total_owned_card_quantity` integer DEFAULT 0 NOT NULL,
	`imported_binder_count` integer DEFAULT 0 NOT NULL,
	`inferred_existing_deck_count` integer DEFAULT 0 NOT NULL,
	`skipped_manabox_lists_json` text DEFAULT '[]' NOT NULL,
	`validation_errors_json` text DEFAULT '[]' NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scryfall_bulk_data_import` (
	`id` text PRIMARY KEY NOT NULL,
	`bulk_data_type` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`source_updated_at` integer,
	`source_uri` text,
	`imported_record_count` integer DEFAULT 0 NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`blocking_errors_json` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "scryfall_bulk_data_import_bulk_data_type_check" CHECK("scryfall_bulk_data_import"."bulk_data_type" IN ('oracle_cards', 'all_cards', 'oracle_tags')),
	CONSTRAINT "scryfall_bulk_data_import_status_check" CHECK("scryfall_bulk_data_import"."status" IN ('succeeded', 'failed'))
);
