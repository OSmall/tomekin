import { z } from "zod";
import {
    type DeckBuildingBrief,
    DeckBuildingBriefSchema,
    DeckFormatSchema,
} from "./deck-building-brief";

export const deckCandidateCardSectionValues = [
    "commander",
    "mainboard",
    "sideboard",
] as const;
export const DeckCandidateCardSectionSchema = z.enum(
    deckCandidateCardSectionValues,
);
export type DeckCandidateCardSection = z.infer<
    typeof DeckCandidateCardSectionSchema
>;

export const DeckCandidateCardInputSchema = z.object({
    cardIdentityId: z.uuid(),
    quantity: z.number().int().positive(),
    section: DeckCandidateCardSectionSchema,
    sortOrder: z.number().int().nonnegative().default(0),
    note: z.string().min(1).nullable().default(null),
});
export type DeckCandidateCardInput = z.infer<
    typeof DeckCandidateCardInputSchema
>;

export const DeckCandidateCardSchema = DeckCandidateCardInputSchema.extend({
    cardName: z.string().min(1),
});
export type DeckCandidateCard = z.infer<typeof DeckCandidateCardSchema>;

// Structured candidate write and read contracts. Timestamps are exact UTC strings.
const text = z
    .string()
    .refine(
        (value) => value.trim().length > 0,
        "Expected meaningful non-whitespace text.",
    );
const shortText = text.superRefine((value, context) => {
    const length = [...value].length;
    if (length > 500)
        context.addIssue({
            code: "custom",
            message: `Maximum 500 Unicode code points; actual length ${length}.`,
        });
});
const uuid = z.uuid();
const timestamp = z.iso.datetime({ precision: 3 });
const evidence = z.array(
    z.strictObject({
        reference: text,
        note: shortText,
        version: text.optional(),
    }),
);
const coverageGoal = z.strictObject({
    sections: z.array(DeckCandidateCardSectionSchema).min(1),
    minimum_copies: z.number().int().nonnegative().nullable().default(null),
    criteria: text,
    rationale: text,
});
const coverageAssessment = z.strictObject({
    summary: text,
    evidence: evidence.optional(),
});
const roleShape = {
    kind: z.literal("role"),
    label: text,
    description: text,
    coverage_goal: coverageGoal.nullable().optional(),
    coverage_assessment: coverageAssessment.nullable().optional(),
    evidence: evidence.optional(),
};
const routeShape = {
    kind: z.literal("win_route"),
    label: text,
    description: text,
    priority: z.enum(["primary", "secondary"]),
    rationale: shortText,
    evidence: evidence.optional(),
};
export const CandidateNodeSchema = z.discriminatedUnion("kind", [
    z.strictObject({ id: uuid, ...roleShape }),
    z.strictObject({ id: uuid, ...routeShape }),
]);
const NewNodeSchema = z.discriminatedUnion("kind", [
    z.strictObject({ ref: text, ...roleShape }),
    z.strictObject({ ref: text, ...routeShape }),
]);
const nodePatch = z.strictObject({
    label: text.optional(),
    description: text.optional(),
    coverage_goal: coverageGoal.nullable().optional(),
    coverage_assessment: coverageAssessment.nullable().optional(),
    evidence: evidence.nullable().optional(),
    priority: z.enum(["primary", "secondary"]).optional(),
    rationale: shortText.optional(),
});
const reasoning = {
    rationale: shortText,
    qualifications: z.array(shortText).optional(),
    evidence: evidence.optional(),
};
const reasoningPatch = z.strictObject({
    rationale: shortText.optional(),
    qualifications: z.array(shortText).nullable().optional(),
    evidence: evidence.nullable().optional(),
});
export const CandidateContributionSchema = z.strictObject({
    card_identity_id: uuid,
    role_id: uuid,
    ...reasoning,
});
const roleReference = { role_id: uuid.optional(), role_ref: text.optional() };
function oneReference(
    value: Record<string, unknown>,
    context: z.RefinementCtx,
    key: string,
) {
    if (
        (value[`${key}_id`] === undefined) ===
        (value[`${key}_ref`] === undefined)
    )
        context.addIssue({
            code: "custom",
            path: [`${key}_id`],
            message: `Supply exactly one of ${key}_id or ${key}_ref.`,
        });
}
const NewContributionSchema = z
    .strictObject({ card_identity_id: uuid, ...roleReference, ...reasoning })
    .superRefine((v, c) => oneReference(v, c, "role"));
const relationshipKind = z.enum([
    "enables",
    "enhances",
    "supports",
    "competes_with",
]);
export const CandidateRelationshipSchema = z.strictObject({
    id: uuid,
    kind: relationshipKind,
    source_id: uuid,
    target_id: uuid,
    ...reasoning,
});
const NewRelationshipSchema = z
    .strictObject({
        ref: text,
        kind: relationshipKind,
        source_id: uuid.optional(),
        source_ref: text.optional(),
        target_id: uuid.optional(),
        target_ref: text.optional(),
        ...reasoning,
    })
    .superRefine((v, c) => {
        oneReference(v, c, "source");
        oneReference(v, c, "target");
    });
export const CandidateOptionSchema = z.strictObject({
    card_identity_id: uuid,
    comparison_note: shortText.nullable().optional(),
});
export const CandidateMembershipSchema = z.strictObject({
    card_identity_id: uuid,
    section: DeckCandidateCardSectionSchema,
    quantity: z.number().int().positive(),
    sort_order: z.number().int().nonnegative().optional(),
    note: text.nullable().optional(),
});
export const CandidateAssessmentsSchema = z.strictObject({
    power_play_experience_fit: text.nullable().optional(),
    mana_curve_adequacy: text.nullable().optional(),
});
const planInput = z.strictObject({
    schema_version: z.literal(1),
    description: text,
    nodes: z.array(NewNodeSchema).default([]),
    contributions: z.array(NewContributionSchema).default([]),
    relationships: z.array(NewRelationshipSchema).default([]),
});
export const CreateDeckCandidateInputSchema = z.strictObject({
    label: text,
    brief: DeckBuildingBriefSchema,
    plan: planInput.optional(),
    options: z.array(CandidateOptionSchema).default([]),
    memberships: z.array(CandidateMembershipSchema).default([]),
    assessments: CandidateAssessmentsSchema.optional(),
});
export type CreateDeckCandidateInput = z.infer<
    typeof CreateDeckCandidateInputSchema
>;
const optionOperation = z.discriminatedUnion("action", [
    CandidateOptionSchema.extend({ action: z.literal("add") }),
    z.strictObject({
        action: z.literal("update"),
        card_identity_id: uuid,
        changes: z.strictObject({
            comparison_note: shortText.nullable().optional(),
        }),
    }),
    z.strictObject({ action: z.literal("remove"), card_identity_id: uuid }),
]);
const nodeOperation = z.union([
    z.strictObject({ action: z.literal("add"), node: NewNodeSchema }),
    z.strictObject({
        action: z.literal("update"),
        id: uuid,
        changes: nodePatch,
    }),
    z.strictObject({ action: z.literal("remove"), id: uuid }),
]);
const contributionOperation = z.union([
    z.strictObject({
        action: z.literal("add"),
        contribution: NewContributionSchema,
    }),
    z
        .strictObject({
            action: z.literal("update"),
            card_identity_id: uuid,
            ...roleReference,
            changes: reasoningPatch,
        })
        .superRefine((v, c) => oneReference(v, c, "role")),
    z
        .strictObject({
            action: z.literal("remove"),
            card_identity_id: uuid,
            ...roleReference,
        })
        .superRefine((v, c) => oneReference(v, c, "role")),
]);
const relationshipPatch = reasoningPatch
    .extend({
        kind: relationshipKind.optional(),
        source_id: uuid.optional(),
        source_ref: text.optional(),
        target_id: uuid.optional(),
        target_ref: text.optional(),
    })
    .superRefine((value, context) => {
        for (const key of ["source", "target"])
            if (
                value[`${key}_id` as keyof typeof value] !== undefined ||
                value[`${key}_ref` as keyof typeof value] !== undefined
            )
                oneReference(value, context, key);
    });
const relationshipOperation = z.union([
    z.strictObject({
        action: z.literal("add"),
        relationship: NewRelationshipSchema,
    }),
    z.strictObject({
        action: z.literal("update"),
        id: uuid,
        changes: relationshipPatch,
    }),
    z.strictObject({ action: z.literal("remove"), id: uuid }),
]);
// Brief patch fields are checked against the resulting discriminated Brief after merging.
const briefPatch = z.strictObject({
    goal: text.optional(),
    format: DeckFormatSchema.optional(),
    formatAnchor: text.nullable().optional(),
    playExperience: text.optional(),
    budget: text.nullable().optional(),
    missingCardTolerance: text.optional(),
    comboTolerance: text.optional(),
    constraints: z.array(text).optional(),
    exclusions: z.array(text).optional(),
    assumptions: z.array(text).optional(),
    commanderBracket: text.nullable().optional(),
    ruleZeroExceptions: z.array(text).optional(),
    powerLevel: text.nullable().optional(),
});
export const DeckCandidateChangesSchema = z.strictObject({
    label: text.optional(),
    brief: briefPatch.optional(),
    plan: z
        .strictObject({
            schema_version: z.literal(1),
            description: text.optional(),
        })
        .nullable()
        .optional(),
    assessments: CandidateAssessmentsSchema.optional(),
    options: z.array(optionOperation).optional(),
    nodes: z.array(nodeOperation).optional(),
    contributions: z.array(contributionOperation).optional(),
    relationships: z.array(relationshipOperation).optional(),
    memberships: z
        .array(
            z.union([
                CandidateMembershipSchema.extend({ action: z.literal("set") }),
                z.strictObject({
                    action: z.literal("remove"),
                    card_identity_id: uuid,
                    section: DeckCandidateCardSectionSchema,
                }),
            ]),
        )
        .optional(),
});
export const EditDeckCandidateInputSchema = z.strictObject({
    candidate_id: uuid,
    expected_updated_at: timestamp,
    changes: DeckCandidateChangesSchema,
});
export type EditDeckCandidateInput = z.infer<
    typeof EditDeckCandidateInputSchema
>;
export type CandidateNode = z.infer<typeof CandidateNodeSchema>;
export type CandidateContribution = z.infer<typeof CandidateContributionSchema>;
export type CandidateRelationship = z.infer<typeof CandidateRelationshipSchema>;
export type CandidateOption = z.infer<typeof CandidateOptionSchema> & {
    readonly card_name?: string;
};
export type CandidateMembership = z.infer<typeof CandidateMembershipSchema> & {
    readonly card_name?: string;
};
export type CandidatePlan = {
    schema_version: 1;
    candidate_id: string;
    description: string;
    nodes: CandidateNode[];
    contributions: CandidateContribution[];
    relationships: CandidateRelationship[];
};
export type DeckCandidateState = {
    id: string;
    label: string;
    format: DeckBuildingBrief["format"];
    formatAnchor: string | null;
    brief: DeckBuildingBrief;
    createdAt: string;
    updatedAt: string;
    selectedChangedAt: string;
    briefChangedAt: string;
    planChangedAt: string;
    plan: CandidatePlan | null;
    options: CandidateOption[];
    memberships: CandidateMembership[];
    assessments: z.infer<typeof CandidateAssessmentsSchema>;
};
export type DeckCandidate = DeckCandidateState & { cards: DeckCandidateCard[] };
export type DeckCandidateSummary = {
    candidate_id: string;
    label: string;
    format: DeckBuildingBrief["format"];
    format_anchor: string | null;
    created_at: string;
    updated_at: string;
    selected_quantities: Record<DeckCandidateCardSection, number>;
    pool_size: number;
    roles: {
        id: string;
        label: string;
        selected_copies: number;
        gap: boolean;
    }[];
    validation_evidence: { status: "absent" | "applicable" | "outdated" };
};
export type CandidateWriteResult = {
    candidate_id: string;
    created_at: string;
    updated_at: string;
    created_ids: Record<string, string>;
    changed_references: string[];
    summary: string;
    validation_evidence: DeckCandidateSummary["validation_evidence"];
};
export type DeckCandidateRepositoryError = {
    readonly type:
        | "repository_error"
        | "not_found"
        | "unresolved_card_identity"
        | "validation_error"
        | "conflict";
    readonly message: string;
    readonly candidate_id?: string;
    readonly expected_updated_at?: string;
    readonly current_updated_at?: string;
};
export type DeckCandidateRepository = {
    createDeckCandidate(
        input: CreateDeckCandidateInput,
    ): Promise<
        import("neverthrow").Result<
            CandidateWriteResult,
            DeckCandidateRepositoryError
        >
    >;
    editDeckCandidate(
        input: EditDeckCandidateInput,
    ): Promise<
        import("neverthrow").Result<
            CandidateWriteResult,
            DeckCandidateRepositoryError
        >
    >;
    getDeckCandidate(
        id: string,
    ): Promise<
        import("neverthrow").Result<DeckCandidate, DeckCandidateRepositoryError>
    >;
    listDeckCandidates(): Promise<
        import("neverthrow").Result<
            readonly DeckCandidateSummary[],
            DeckCandidateRepositoryError
        >
    >;
};
export function summarizeDeckCandidate(
    candidate: DeckCandidateState,
): DeckCandidateSummary {
    const selected_quantities = { commander: 0, mainboard: 0, sideboard: 0 };
    for (const membership of candidate.memberships)
        selected_quantities[membership.section] += membership.quantity;
    return {
        candidate_id: candidate.id,
        label: candidate.label,
        format: candidate.brief.format,
        format_anchor: candidate.brief.formatAnchor,
        created_at: candidate.createdAt,
        updated_at: candidate.updatedAt,
        selected_quantities,
        pool_size: candidate.options.length,
        roles: (candidate.plan?.nodes ?? [])
            .filter(
                (node): node is Extract<CandidateNode, { kind: "role" }> =>
                    node.kind === "role",
            )
            .map((node) => {
                const selected_copies = roleSelectedCopies(candidate, node);
                return {
                    id: node.id,
                    label: node.label,
                    selected_copies,
                    gap: selected_copies === 0,
                };
            }),
        validation_evidence: { status: "absent" },
    };
}
export function roleSelectedCopies(
    candidate: DeckCandidateState,
    role: Extract<CandidateNode, { kind: "role" }>,
): number {
    const contributors = new Set(
        candidate.plan?.contributions
            .filter((c) => c.role_id === role.id)
            .map((c) => c.card_identity_id),
    );
    return candidate.memberships
        .filter(
            (m) =>
                contributors.has(m.card_identity_id) &&
                (!role.coverage_goal ||
                    role.coverage_goal.sections.includes(m.section)),
        )
        .reduce((sum, m) => sum + m.quantity, 0);
}

export function candidateCardCount(
    cards: readonly { readonly quantity: number }[],
): number {
    return cards.reduce((sum, card) => sum + card.quantity, 0);
}

export function briefFormatAnchor(brief: DeckBuildingBrief): string | null {
    return brief.formatAnchor ?? null;
}
