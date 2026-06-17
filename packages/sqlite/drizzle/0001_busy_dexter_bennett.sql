CREATE TABLE `card_identity_parts`
(
    `card_identity_id` text    NOT NULL,
    `part_index`       integer NOT NULL,
    `name`             text    NOT NULL,
    `mana_cost`        text,
    `type_line`        text,
    `oracle_text`      text,
    `colors`           text,
    `color_indicator`  text,
    `power`            text,
    `toughness`        text,
    `loyalty`          text,
    `defense`          text,
    PRIMARY KEY (`card_identity_id`, `part_index`),
    FOREIGN KEY (`card_identity_id`) REFERENCES `card_identities` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_parts_card_identity_id` ON `card_identity_parts` (`card_identity_id`);--> statement-breakpoint
CREATE TABLE `card_printing_parts`
(
    `card_printing_id`  text    NOT NULL,
    `part_index`        integer NOT NULL,
    `printed_name`      text,
    `flavor_name`       text,
    `printed_type_line` text,
    `printed_text`      text,
    `flavor_text`       text,
    `artist`            text,
    `artist_id`         text,
    `illustration_id`   text,
    `image_uris_json`   text,
    PRIMARY KEY (`card_printing_id`, `part_index`),
    FOREIGN KEY (`card_printing_id`) REFERENCES `card_printings` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_printing_parts_card_printing_id` ON `card_printing_parts` (`card_printing_id`);--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `layout` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `colors` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `color_indicator` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `produced_mana` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `keywords_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `power` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `toughness` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `loyalty` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `defense` text;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `edhrec_rank` integer;--> statement-breakpoint
ALTER TABLE `card_identities`
    ADD `game_changer` integer;--> statement-breakpoint
ALTER TABLE `card_printings`
    ADD `layout` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `card_printings`
    ADD `tcgplayer_id` integer;--> statement-breakpoint
ALTER TABLE `card_printings`
    ADD `cardmarket_id` integer;