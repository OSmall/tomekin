CREATE TABLE `card_identities`
(
    `id`              text PRIMARY KEY NOT NULL,
    `name`            text             NOT NULL,
    `mana_cost`       text,
    `mana_value`      real             NOT NULL,
    `type_line`       text             NOT NULL,
    `oracle_text`     text,
    `color_identity`  text DEFAULT ''  NOT NULL,
    `source_page_uri` text             NOT NULL,
    CONSTRAINT "card_identities_color_identity_check" CHECK ("card_identities"."color_identity" IN
                                                             ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB',
                                                              'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR',
                                                              'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG',
                                                              'WURG', 'WBRG', 'UBRG', 'WUBRG'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_identities_color_identity` ON `card_identities` (`color_identity`);--> statement-breakpoint
CREATE TABLE `card_identity_format_legalities`
(
    `card_identity_id` text NOT NULL,
    `format`           text NOT NULL,
    `legality`         text NOT NULL,
    PRIMARY KEY (`card_identity_id`, `format`),
    FOREIGN KEY (`card_identity_id`) REFERENCES `card_identities` (`id`) ON UPDATE no action ON DELETE no action,
    CONSTRAINT "card_identity_format_legalities_format_check" CHECK (length("card_identity_format_legalities"."format") > 0),
    CONSTRAINT "card_identity_format_legalities_legality_check" CHECK ("card_identity_format_legalities"."legality" IN
                                                                       ('legal', 'not_legal', 'banned', 'restricted'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_format_legalities_card_identity_id` ON `card_identity_format_legalities` (`card_identity_id`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_format_legalities_format_legality` ON `card_identity_format_legalities` (`format`, `legality`);--> statement-breakpoint
CREATE TABLE `card_identity_tag_aliases`
(
    `tag_id` text NOT NULL,
    `alias`  text NOT NULL,
    PRIMARY KEY (`tag_id`, `alias`),
    FOREIGN KEY (`tag_id`) REFERENCES `card_identity_tags` (`id`) ON UPDATE no action ON DELETE no action,
    CONSTRAINT "card_identity_tag_aliases_alias_check" CHECK (length("card_identity_tag_aliases"."alias") > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_tag_aliases_tag_id` ON `card_identity_tag_aliases` (`tag_id`);--> statement-breakpoint
CREATE TABLE `card_identity_tag_hierarchy`
(
    `parent_tag_id` text NOT NULL,
    `child_tag_id`  text NOT NULL,
    PRIMARY KEY (`parent_tag_id`, `child_tag_id`),
    FOREIGN KEY (`parent_tag_id`) REFERENCES `card_identity_tags` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`child_tag_id`) REFERENCES `card_identity_tags` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_tag_hierarchy_child_tag_id` ON `card_identity_tag_hierarchy` (`child_tag_id`);--> statement-breakpoint
CREATE TABLE `card_identity_taggings`
(
    `tag_id`           text NOT NULL,
    `card_identity_id` text NOT NULL,
    `weight`           text NOT NULL,
    `annotation`       text,
    PRIMARY KEY (`tag_id`, `card_identity_id`),
    FOREIGN KEY (`tag_id`) REFERENCES `card_identity_tags` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`card_identity_id`) REFERENCES `card_identities` (`id`) ON UPDATE no action ON DELETE no action,
    CONSTRAINT "card_identity_taggings_weight_check" CHECK ("card_identity_taggings"."weight" IN
                                                            ('very_strong', 'strong', 'median', 'weak'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_identity_taggings_card_identity_id` ON `card_identity_taggings` (`card_identity_id`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_taggings_tag_id` ON `card_identity_taggings` (`tag_id`);--> statement-breakpoint
CREATE TABLE `card_identity_tags`
(
    `id`              text PRIMARY KEY NOT NULL,
    `slug`            text             NOT NULL,
    `label`           text             NOT NULL,
    `description`     text,
    `source_page_uri` text             NOT NULL,
    CONSTRAINT "card_identity_tags_slug_check" CHECK (length("card_identity_tags"."slug") > 0),
    CONSTRAINT "card_identity_tags_label_check" CHECK (length("card_identity_tags"."label") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_identity_tags_slug_unique` ON `card_identity_tags` (`slug`);--> statement-breakpoint
CREATE TABLE `card_printings`
(
    `id`               text PRIMARY KEY  NOT NULL,
    `card_identity_id` text              NOT NULL,
    `printed_name`     text,
    `set_code`         text              NOT NULL,
    `collector_number` text              NOT NULL,
    `finishes_json`    text DEFAULT '[]' NOT NULL,
    `language`         text              NOT NULL,
    `source_page_uri`  text              NOT NULL,
    FOREIGN KEY (`card_identity_id`) REFERENCES `card_identities` (`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_card_printings_card_identity_id` ON `card_printings` (`card_identity_id`);--> statement-breakpoint
CREATE TABLE `collection_imports`
(
    `id`                           text PRIMARY KEY     NOT NULL,
    `status`                       text                 NOT NULL,
    `imported_at`                  integer              NOT NULL,
    `source_format`                text                 NOT NULL,
    `source_label`                 text                 NOT NULL,
    `imported_owned_card_rows`     integer DEFAULT 0    NOT NULL,
    `total_owned_card_quantity`    integer DEFAULT 0    NOT NULL,
    `imported_binder_count`        integer DEFAULT 0    NOT NULL,
    `inferred_existing_deck_count` integer DEFAULT 0    NOT NULL,
    `skipped_manabox_lists_json`   text    DEFAULT '[]' NOT NULL,
    `validation_errors_json`       text    DEFAULT '[]' NOT NULL,
    `warnings_json`                text    DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scryfall_bulk_data_imports`
(
    `id`                    text PRIMARY KEY     NOT NULL,
    `bulk_data_type`        text                 NOT NULL,
    `status`                text                 NOT NULL,
    `started_at`            integer              NOT NULL,
    `completed_at`          integer,
    `source_updated_at`     integer,
    `source_uri`            text,
    `imported_record_count` integer DEFAULT 0    NOT NULL,
    `warnings_json`         text    DEFAULT '[]' NOT NULL,
    `blocking_errors_json`  text    DEFAULT '[]' NOT NULL,
    CONSTRAINT "scryfall_bulk_data_imports_bulk_data_type_check" CHECK ("scryfall_bulk_data_imports"."bulk_data_type" IN
                                                                        ('oracle_cards', 'all_cards', 'oracle_tags')),
    CONSTRAINT "scryfall_bulk_data_imports_status_check" CHECK ("scryfall_bulk_data_imports"."status" IN ('succeeded', 'failed'))
);
