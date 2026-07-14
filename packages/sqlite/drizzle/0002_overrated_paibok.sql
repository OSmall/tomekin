CREATE TABLE `card_printing_finish`
(
    `card_printing_id` text NOT NULL,
    `finish`           text NOT NULL,
    PRIMARY KEY (`card_printing_id`, `finish`),
    FOREIGN KEY (`card_printing_id`) REFERENCES `card_printing` (`id`) ON UPDATE no action ON DELETE no action,
    CONSTRAINT "card_printing_finish_finish_check" CHECK ("card_printing_finish"."finish" IN ('nonfoil', 'foil', 'etched'))
);
--> statement-breakpoint
CREATE INDEX `idx_card_printing_finish_card_printing_id` ON `card_printing_finish` (`card_printing_id`);--> statement-breakpoint
CREATE TABLE `collection_card`
(
    `id`                      text PRIMARY KEY NOT NULL,
    `quantity`                integer          NOT NULL,
    `collection_location_id`  text             NOT NULL,
    `finish`                  text             NOT NULL,
    `mana_box_id`             text,
    `card_printing_id`        text             NOT NULL,
    `misprint`                integer          NOT NULL,
    `altered`                 integer          NOT NULL,
    `condition`               text,
    `purchase_price_currency` text,
    `purchase_price`          real,
    `added_at`                integer,
    `source_row_number`       integer          NOT NULL,
    FOREIGN KEY (`collection_location_id`) REFERENCES `collection_location` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`card_printing_id`) REFERENCES `card_printing` (`id`) ON UPDATE no action ON DELETE no action,
    CONSTRAINT "collection_card_quantity_check" CHECK ("collection_card"."quantity" > 0),
    CONSTRAINT "collection_card_finish_check" CHECK ("collection_card"."finish" IN ('nonfoil', 'foil', 'etched'))
);
--> statement-breakpoint
CREATE INDEX `idx_collection_card_location_id` ON `collection_card` (`collection_location_id`);--> statement-breakpoint
CREATE INDEX `idx_collection_card_card_printing_id` ON `collection_card` (`card_printing_id`);--> statement-breakpoint
CREATE TABLE `collection_location`
(
    `id`   text PRIMARY KEY NOT NULL,
    `name` text             NOT NULL,
    `type` text             NOT NULL,
    CONSTRAINT "collection_location_name_check" CHECK (length("collection_location"."name") > 0),
    CONSTRAINT "collection_location_type_check" CHECK ("collection_location"."type" IN ('binder', 'deck'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_location_type_name_unique` ON `collection_location` (`type`, `name`);--> statement-breakpoint
ALTER TABLE `card_printing`
    DROP COLUMN `finishes_json`;