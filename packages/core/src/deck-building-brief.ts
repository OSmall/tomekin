import {z} from "zod";

export const deckFormatValues = [
  "commander",
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "pauper",
  "casual_60",
] as const;
export const DeckFormatSchema = z.enum(deckFormatValues);
export type DeckFormat = z.infer<typeof DeckFormatSchema>;

export const sixtyCardConstructedFormatValues = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "pauper",
  "casual_60",
] as const;
export const SixtyCardConstructedFormatSchema = z.enum(sixtyCardConstructedFormatValues);
export type SixtyCardConstructedFormat = z.infer<typeof SixtyCardConstructedFormatSchema>;

const sharedBriefShape = {
  goal: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text."),
  formatAnchor: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").nullable().default(null),
  playExperience: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").default("Synergistic, varied, expressive, and fair-feeling."),
  budget: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").nullable().default(null),
  missingCardTolerance: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").default("Moderate; check the imported Collection before treating cards as Missing Cards."),
  comboTolerance: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").default("Avoid deterministic combo wins unless explicitly requested."),
  constraints: z.array(z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.")).default([]),
  exclusions: z.array(z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.")).default([]),
  assumptions: z.array(z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.")).default([]),
};

export const CommanderDeckBuildingBriefSchema = z.strictObject({
  ...sharedBriefShape,
  format: z.literal("commander"),
  commanderBracket: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").nullable(),
  ruleZeroExceptions: z.array(z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.")),
});
export type CommanderDeckBuildingBrief = z.infer<typeof CommanderDeckBuildingBriefSchema>;

export const SixtyCardConstructedDeckBuildingBriefSchema = z.strictObject({
  ...sharedBriefShape,
  format: SixtyCardConstructedFormatSchema,
  powerLevel: z.string().refine(value => value.trim().length > 0, "Expected meaningful non-whitespace text.").nullable(),
});
export type SixtyCardConstructedDeckBuildingBrief = z.infer<typeof SixtyCardConstructedDeckBuildingBriefSchema>;

export const DeckBuildingBriefSchema = z.discriminatedUnion("format", [
  CommanderDeckBuildingBriefSchema,
  SixtyCardConstructedDeckBuildingBriefSchema,
]);
export type DeckBuildingBrief = z.infer<typeof DeckBuildingBriefSchema>;

// Branch defaults make the draft input concise, but Format and branch-specific
// power fields stay explicit confirmed instructions.
export const DraftDeckBuildingBriefInputSchema = DeckBuildingBriefSchema;
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
    ...(brief.format === "commander" && brief.commanderBracket === null
      ? ["Commander Bracket was not specified; confirm the intended table experience before deck-building."]
      : []),
    "Collection availability must be checked against the imported Collection snapshot before candidate cards are treated as Missing Cards.",
  ];

  return {
    brief: {...brief, assumptions},
    confirmationRequired: true,
    assumptionsToConfirm: assumptions,
  };
}
