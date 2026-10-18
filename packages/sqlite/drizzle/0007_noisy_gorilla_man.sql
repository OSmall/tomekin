CREATE TABLE `deck_candidate_contribution` (
	`candidate_id` text NOT NULL,
	`card_identity_id` text NOT NULL,
	`role_id` text NOT NULL,
	`rationale` text NOT NULL,
	`qualifications_json` text,
	`evidence_json` text,
	PRIMARY KEY(`candidate_id`, `card_identity_id`, `role_id`),
	FOREIGN KEY (`candidate_id`,`card_identity_id`) REFERENCES `deck_candidate_option`(`candidate_id`,`card_identity_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`,`role_id`) REFERENCES `deck_candidate_node`(`candidate_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "candidate_contribution_rationale" CHECK(length(trim("deck_candidate_contribution"."rationale")) > 0)
);
--> statement-breakpoint
CREATE TABLE `deck_candidate_node` (
	`candidate_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`description` text NOT NULL,
	`priority` text,
	`rationale` text,
	`coverage_goal_json` text,
	`coverage_assessment_json` text,
	`evidence_json` text,
	PRIMARY KEY(`candidate_id`, `id`),
	FOREIGN KEY (`candidate_id`) REFERENCES `deck_candidate_plan`(`candidate_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "candidate_node_kind" CHECK("deck_candidate_node"."kind" IN ('role','win_route')),
	CONSTRAINT "candidate_node_text" CHECK(length(trim("deck_candidate_node"."label")) > 0 AND length(trim("deck_candidate_node"."description")) > 0),
	CONSTRAINT "candidate_node_fields" CHECK(("deck_candidate_node"."kind" = 'role' AND "deck_candidate_node"."priority" IS NULL AND "deck_candidate_node"."rationale" IS NULL) OR ("deck_candidate_node"."kind" = 'win_route' AND "deck_candidate_node"."priority" IN ('primary','secondary') AND "deck_candidate_node"."rationale" IS NOT NULL AND length(trim("deck_candidate_node"."rationale")) > 0 AND "deck_candidate_node"."coverage_goal_json" IS NULL AND "deck_candidate_node"."coverage_assessment_json" IS NULL))
);
--> statement-breakpoint
CREATE TABLE `deck_candidate_option` (
	`candidate_id` text NOT NULL,
	`card_identity_id` text NOT NULL,
	`comparison_note` text,
	PRIMARY KEY(`candidate_id`, `card_identity_id`),
	FOREIGN KEY (`candidate_id`) REFERENCES `deck_candidate`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "candidate_option_note" CHECK("deck_candidate_option"."comparison_note" IS NULL OR length(trim("deck_candidate_option"."comparison_note")) > 0)
);
--> statement-breakpoint
CREATE TABLE `deck_candidate_plan` (
	`candidate_id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `deck_candidate`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deck_candidate_plan_description" CHECK(length(trim("deck_candidate_plan"."description")) > 0)
);
--> statement-breakpoint
CREATE TABLE `deck_candidate_relationship` (
	`candidate_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`rationale` text NOT NULL,
	`qualifications_json` text,
	`evidence_json` text,
	PRIMARY KEY(`candidate_id`, `id`),
	FOREIGN KEY (`candidate_id`,`source_id`) REFERENCES `deck_candidate_node`(`candidate_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`,`target_id`) REFERENCES `deck_candidate_node`(`candidate_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "candidate_relationship_kind" CHECK("deck_candidate_relationship"."kind" IN ('enables','enhances','supports','competes_with')),
	CONSTRAINT "candidate_relationship_distinct" CHECK("deck_candidate_relationship"."source_id" != "deck_candidate_relationship"."target_id"),
	CONSTRAINT "candidate_relationship_symmetric" CHECK("deck_candidate_relationship"."kind" != 'competes_with' OR "deck_candidate_relationship"."source_id" < "deck_candidate_relationship"."target_id"),
	CONSTRAINT "candidate_relationship_rationale" CHECK(length(trim("deck_candidate_relationship"."rationale")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_relationship_logical` ON `deck_candidate_relationship` (`candidate_id`,`kind`,`source_id`,`target_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_deck_candidate_card` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_candidate_id` text NOT NULL,
	`card_identity_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`section` text NOT NULL,
	`sort_order` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`deck_candidate_id`) REFERENCES `deck_candidate`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_identity_id`) REFERENCES `card_identity`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "deck_candidate_card_quantity_check" CHECK(typeof("quantity") = 'integer' AND "quantity" > 0),
	CONSTRAINT "deck_candidate_card_sort_order_check" CHECK(typeof("sort_order") = 'integer' AND "sort_order" >= 0),
	CONSTRAINT "deck_candidate_card_section_check" CHECK("section" IN ('commander', 'mainboard', 'sideboard'))
);
--> statement-breakpoint
INSERT INTO `__new_deck_candidate_card`("id", "deck_candidate_id", "card_identity_id", "quantity", "section", "sort_order", "note") SELECT "id", "deck_candidate_id", "card_identity_id", "quantity", "section", "sort_order", "note" FROM `deck_candidate_card`;--> statement-breakpoint
DROP TABLE `deck_candidate_card`;--> statement-breakpoint
ALTER TABLE `__new_deck_candidate_card` RENAME TO `deck_candidate_card`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_deck_candidate_card_deck_candidate_id` ON `deck_candidate_card` (`deck_candidate_id`);--> statement-breakpoint
CREATE INDEX `idx_deck_candidate_card_card_identity_id` ON `deck_candidate_card` (`card_identity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `deck_candidate_card_membership_unique` ON `deck_candidate_card` (`deck_candidate_id`,`card_identity_id`,`section`);--> statement-breakpoint
ALTER TABLE `deck_candidate` ADD `created_at_exact` text;--> statement-breakpoint
ALTER TABLE `deck_candidate` ADD `updated_at_exact` text;--> statement-breakpoint
ALTER TABLE `deck_candidate` ADD `selected_changed_at` text;--> statement-breakpoint
ALTER TABLE `deck_candidate` ADD `brief_changed_at` text;--> statement-breakpoint
ALTER TABLE `deck_candidate` ADD `plan_changed_at` text;--> statement-breakpoint
ALTER TABLE `deck_candidate` ADD `assessments_json` text;