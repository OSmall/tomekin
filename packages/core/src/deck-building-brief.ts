import {z} from "zod";

export const DeckFormatSchema = z.enum(["commander"]);
export type DeckFormat = z.infer<typeof DeckFormatSchema>;

export const DeckBuildingBriefSchema = z.object({
  goal: z.string().min(1),
  format: DeckFormatSchema.default("commander"),
  formatAnchor: z.string().min(1).nullable().default(null),
  playExperience: z.string().min(1).default("Synergistic, varied, expressive, and fair-feeling."),
  commanderBracket: z.string().min(1).nullable().default(null),
  budget: z.string().min(1).nullable().default(null),
  missingCardTolerance: z.string().min(1).default("Moderate; collection is empty in the first slice, so every card is a Missing Card."),
  comboTolerance: z.string().min(1).default("Avoid deterministic combo wins unless explicitly requested."),
  constraints: z.array(z.string().min(1)).default([]),
  exclusions: z.array(z.string().min(1)).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  ruleZeroExceptions: z.array(z.string().min(1)).default([]),
});
export type DeckBuildingBrief = z.infer<typeof DeckBuildingBriefSchema>;

export const DraftDeckBuildingBriefInputSchema = DeckBuildingBriefSchema.partial({
  goal: true,
}).extend({
  goal: z.string().min(1),
});
export type DraftDeckBuildingBriefInput = z.input<typeof DraftDeckBuildingBriefInputSchema>;

export type DraftDeckBuildingBriefOutput = {
  readonly brief: DeckBuildingBrief;
  readonly confirmationRequired: true;
  readonly assumptionsToConfirm: readonly string[];
};

export function draftDeckBuildingBrief(input: DraftDeckBuildingBriefInput): DraftDeckBuildingBriefOutput {
  const brief = DeckBuildingBriefSchema.parse(input);
  const assumptions = [
    ...brief.assumptions,
    ...(brief.commanderBracket === null
      ? ["Commander Bracket was not specified; confirm the intended table experience before deck-building."]
      : []),
    "Collection is treated as empty in this first slice, so every candidate card is a Missing Card.",
  ];

  return {
    brief: {...brief, assumptions},
    confirmationRequired: true,
    assumptionsToConfirm: assumptions,
  };
}
