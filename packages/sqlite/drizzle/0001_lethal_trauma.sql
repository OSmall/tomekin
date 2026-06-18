CREATE TABLE `deck_candidate` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`format` text NOT NULL,
	`format_anchor` text,
	`commander_bracket` text,
	`brief_json` text NOT NULL,
	`collection_import_timestamp` integer,
	`markdown` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "deck_candidate_label_check" CHECK(length("deck_candidate"."label") > 0),
	CONSTRAINT "deck_candidate_format_check" CHECK("deck_candidate"."format" IN ('commander'))
);
--> statement-breakpoint
CREATE TABLE `deck_candidate_card` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_candidate_id` text NOT NULL,
	`card_identity_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`section` text NOT NULL,
	`sort_order` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`deck_candidate_id`) REFERENCES `deck_candidate`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deck_candidate_card_quantity_check" CHECK("deck_candidate_card"."quantity" > 0),
	CONSTRAINT "deck_candidate_card_section_check" CHECK("deck_candidate_card"."section" IN ('commander', 'deck'))
);
--> statement-breakpoint
CREATE INDEX `idx_deck_candidate_card_deck_candidate_id` ON `deck_candidate_card` (`deck_candidate_id`);--> statement-breakpoint
CREATE INDEX `idx_deck_candidate_card_card_identity_id` ON `deck_candidate_card` (`card_identity_id`);