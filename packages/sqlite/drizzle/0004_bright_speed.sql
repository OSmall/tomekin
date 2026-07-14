CREATE INDEX `idx_card_identity_name` ON `card_identity` (`name`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_type_line` ON `card_identity` (`type_line`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_mana_value` ON `card_identity` (`mana_value`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_colors` ON `card_identity` (`colors`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_game_changer` ON `card_identity` (`game_changer`);--> statement-breakpoint
CREATE INDEX `idx_card_identity_edhrec_rank` ON `card_identity` (`edhrec_rank`);--> statement-breakpoint
CREATE INDEX `idx_collection_card_finish` ON `collection_card` (`finish`);--> statement-breakpoint
CREATE INDEX `idx_collection_card_altered` ON `collection_card` (`altered`);--> statement-breakpoint
CREATE INDEX `idx_collection_card_misprint` ON `collection_card` (`misprint`);--> statement-breakpoint
CREATE INDEX `idx_collection_location_name` ON `collection_location` (`name`);