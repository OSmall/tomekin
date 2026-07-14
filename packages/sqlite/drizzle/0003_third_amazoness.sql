PRAGMA defer_foreign_keys= ON;--> statement-breakpoint
CREATE TABLE `__new_card_identity`
(
    `id`              text PRIMARY KEY      NOT NULL,
    `name`            text                  NOT NULL,
    `layout`          text DEFAULT 'normal' NOT NULL,
    `mana_cost`       text,
    `mana_value`      real                  NOT NULL,
    `type_line`       text                  NOT NULL,
    `oracle_text`     text,
    `color_identity`  text DEFAULT ''       NOT NULL,
    `colors`          text,
    `color_indicator` text,
    `produced_mana`   text,
    `keywords_json`   text DEFAULT '[]'     NOT NULL,
    `power`           text,
    `toughness`       text,
    `loyalty`         text,
    `defense`         text,
    `edhrec_rank`     integer,
    `game_changer`    integer               NOT NULL,
    `source_page_uri` text                  NOT NULL,
    CONSTRAINT "card_identity_color_identity_check" CHECK (color_identity IN
                                                           ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB',
                                                            'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR',
                                                            'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG',
                                                            'WURG', 'WBRG', 'UBRG', 'WUBRG'))
);
--> statement-breakpoint
INSERT INTO `__new_card_identity`("id", "name", "layout", "mana_cost", "mana_value", "type_line", "oracle_text",
                                  "color_identity", "colors", "color_indicator", "produced_mana", "keywords_json",
                                  "power", "toughness", "loyalty", "defense", "edhrec_rank", "game_changer",
                                  "source_page_uri")
SELECT "id",
       "name",
       "layout",
       "mana_cost",
       "mana_value",
       "type_line",
       "oracle_text",
       "color_identity",
       "colors",
       "color_indicator",
       "produced_mana",
       "keywords_json",
       "power",
       "toughness",
       "loyalty",
       "defense",
       "edhrec_rank",
       COALESCE("game_changer", 0),
       "source_page_uri"
FROM `card_identity`;--> statement-breakpoint
DROP TABLE `card_identity`;--> statement-breakpoint
ALTER TABLE `__new_card_identity`
    RENAME TO `card_identity`;--> statement-breakpoint
CREATE INDEX `idx_card_identity_color_identity` ON `card_identity` (`color_identity`);
