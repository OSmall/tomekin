import { DeckBuildingBriefSchema } from "./deck-building-brief";
import {
    CandidateContributionSchema,
    CandidateNodeSchema,
    CandidateRelationshipSchema,
    roleSelectedCopies,
    type CreateDeckCandidateInput,
    type DeckCandidate,
    type DeckCandidateState,
    type DeckCandidateRepositoryError,
    type EditDeckCandidateInput,
} from "./deck-candidate";

function invalid(path: string, message: string): never {
    throw {
        type: "validation_error",
        message: `${path}: ${message}`,
    } satisfies DeckCandidateRepositoryError;
}
const contributionKey = (value: {
    card_identity_id: string;
    role_id: string;
}) => `${value.card_identity_id}/${value.role_id}`;
const membershipKey = (value: { card_identity_id: string; section: string }) =>
    `${value.card_identity_id}/${value.section}`;
function duplicate(keys: string[], path: string) {
    const seen = new Set<string>();
    for (const key of keys) {
        if (seen.has(key))
            invalid(path, `Duplicate/conflicting logical record ${key}.`);
        seen.add(key);
    }
}
function patch<T extends object>(baseline: T, changes: object): T {
    const result = { ...baseline } as Record<string, unknown>;
    for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) continue;
        if (value === null) delete result[key];
        else result[key] = value;
    }
    return result as T;
}
export function constructDeckCandidate(
    input: CreateDeckCandidateInput,
    id: string,
    now: string,
    newId: () => string,
) {
    const candidate: DeckCandidateState = {
        id,
        label: input.label,
        brief: input.brief,
        format: input.brief.format,
        formatAnchor: input.brief.formatAnchor,
        createdAt: now,
        updatedAt: now,
        selectedChangedAt: now,
        briefChangedAt: now,
        planChangedAt: now,
        plan: null,
        options: [],
        memberships: [],
        assessments: {},
    };
    return reviseDeckCandidate(
        candidate,
        {
            candidate_id: id,
            expected_updated_at: now,
            changes: {
                ...(input.plan
                    ? {
                          plan: {
                              schema_version: 1,
                              description: input.plan.description,
                          },
                      }
                    : {}),
                options: input.options.map((option) => ({
                    action: "add" as const,
                    ...option,
                })),
                nodes: input.plan?.nodes.map((node) => ({
                    action: "add" as const,
                    node,
                })),
                contributions: input.plan?.contributions.map(
                    (contribution) => ({
                        action: "add" as const,
                        contribution,
                    }),
                ),
                relationships: input.plan?.relationships.map(
                    (relationship) => ({
                        action: "add" as const,
                        relationship,
                    }),
                ),
                memberships: input.memberships.map((m) => ({
                    action: "set" as const,
                    ...m,
                })),
                assessments: input.assessments,
            },
        },
        now,
        newId,
    );
}
export function reviseDeckCandidate(
    baseline: DeckCandidateState,
    input: EditDeckCandidateInput,
    now: string,
    newId: () => string,
): {
    candidate: DeckCandidateState;
    createdIds: Record<string, string>;
    changedReferences: string[];
} {
    const candidate = structuredClone(baseline);
    // Read-only name projections are recomputed after persistence, never carried into a trial result.
    delete (candidate as Partial<DeckCandidate>).cards;
    const changes = input.changes;
    const createdIds: Record<string, string> = Object.create(null);
    const changedReferences: string[] = [];
    if (changes.label !== undefined) candidate.label = changes.label;
    if (changes.brief) {
        const merged: Record<string, unknown> = {
            ...candidate.brief,
            ...changes.brief,
        };
        if (
            changes.brief.format &&
            changes.brief.format !== candidate.brief.format
        ) {
            // A Format switch retains shared preferences, replacing only branch-owned fields.
            if (changes.brief.format === "commander") delete merged.powerLevel;
            else {
                delete merged.commanderBracket;
                delete merged.ruleZeroExceptions;
            }
        }
        candidate.brief = DeckBuildingBriefSchema.parse(merged);
        candidate.format = candidate.brief.format;
        candidate.formatAnchor = candidate.brief.formatAnchor;
    }
    if (changes.plan && !candidate.plan) {
        if (!changes.plan.description)
            invalid(
                "changes.plan.description",
                "Required when introducing a plan.",
            );
        candidate.plan = {
            schema_version: 1,
            candidate_id: candidate.id,
            description: changes.plan.description,
            nodes: [],
            contributions: [],
            relationships: [],
        };
    }
    if (changes.plan?.description && candidate.plan)
        candidate.plan.description = changes.plan.description;
    if (changes.assessments)
        candidate.assessments = {
            ...candidate.assessments,
            ...changes.assessments,
        };
    function declareRef(ref: string) {
        if (Object.hasOwn(createdIds, ref))
            invalid("ref", `Duplicate request-local reference ${ref}.`);
        const id = newId();
        createdIds[ref] = id;
        return id;
    }
    // Declare every new authored element before resolving any cross-reference.
    for (const operation of changes.nodes ?? [])
        if (operation.action === "add") declareRef(operation.node.ref);
    for (const operation of changes.relationships ?? [])
        if (operation.action === "add") declareRef(operation.relationship.ref);
    function resolve(value: { [key: string]: unknown }, key: string): string {
        const id = value[`${key}_id`];
        if (typeof id === "string") return id;
        const ref = value[`${key}_ref`];
        if (typeof ref !== "string" || !Object.hasOwn(createdIds, ref))
            invalid(`${key}_ref`, `Unknown local reference ${String(ref)}.`);
        return createdIds[ref]!;
    }
    function operations<
        T,
        O extends { action: "add" | "update" | "remove" | "set" },
    >(
        records: T[],
        edits: readonly O[],
        key: (record: T) => string,
        operationKey: (operation: O) => string,
        path: string,
        make: (operation: O) => T,
        update: (record: T, operation: O) => T,
    ) {
        duplicate(edits.map(operationKey), path);
        for (const operation of edits) {
            const recordKey = operationKey(operation),
                index = records.findIndex(
                    (record) => key(record) === recordKey,
                );
            const previous = index < 0 ? undefined : records[index];
            if (operation.action === "add") {
                if (index !== -1)
                    invalid(path, `Record already exists: ${recordKey}.`);
                records.push(make(operation));
            } else if (operation.action === "remove") {
                if (index === -1)
                    invalid(
                        path,
                        `Unknown candidate-owned record ${recordKey}.`,
                    );
                records.splice(index, 1);
            } else if (operation.action === "set" && index === -1)
                records.push(make(operation));
            else {
                if (index === -1)
                    invalid(
                        path,
                        `Unknown candidate-owned record ${recordKey}.`,
                    );
                records[index] = update(records[index]!, operation);
            }
            const resulting = records.find(
                (record) => key(record) === recordKey,
            );
            if (JSON.stringify(previous) !== JSON.stringify(resulting))
                changedReferences.push(`${path}:${recordKey}`);
        }
    }
    operations(
        candidate.options,
        changes.options ?? [],
        (o) => o.card_identity_id,
        (o) => o.card_identity_id,
        "options",
        (o) => {
            if (o.action !== "add")
                return invalid("options", "Expected an add operation.");
            const { action, ...record } = o;
            return record;
        },
        (record, o) => {
            if (o.action !== "update")
                return invalid("options", "Expected an update operation.");
            return { ...record, ...o.changes };
        },
    );
    operations(
        candidate.memberships,
        changes.memberships ?? [],
        membershipKey,
        membershipKey,
        "memberships",
        (o) => {
            if (o.action !== "set")
                return invalid("memberships", "Expected a set operation.");
            const { action, ...record } = o;
            return record;
        },
        (record, o) => {
            if (o.action !== "set")
                return invalid("memberships", "Expected a set operation.");
            const { action, ...fields } = o;
            return { ...record, ...fields };
        },
    );
    if (
        (changes.nodes?.length ||
            changes.contributions?.length ||
            changes.relationships?.length) &&
        !candidate.plan
    )
        invalid("plan", "Graph records require a current plan.");
    if (candidate.plan) {
        operations(
            candidate.plan.nodes,
            changes.nodes ?? [],
            (o) => o.id,
            (o) => (o.action === "add" ? createdIds[o.node.ref]! : o.id),
            "nodes",
            (o) => {
                if (o.action !== "add")
                    return invalid("nodes", "Expected an add operation.");
                const { ref, ...record } = o.node;
                return { ...record, id: createdIds[ref]! };
            },
            (record, o) => {
                if (o.action !== "update")
                    return invalid("nodes", "Expected an update operation.");
                return CandidateNodeSchema.parse(patch(record, o.changes));
            },
        );
        operations(
            candidate.plan.contributions,
            changes.contributions ?? [],
            contributionKey,
            (o) => {
                const value = o.action === "add" ? o.contribution : o;
                return contributionKey({
                    card_identity_id: value.card_identity_id,
                    role_id: resolve(value, "role"),
                });
            },
            "contributions",
            (o) => {
                if (o.action !== "add")
                    return invalid(
                        "contributions",
                        "Expected an add operation.",
                    );
                const { role_ref, role_id, ...record } = o.contribution;
                return { ...record, role_id: resolve(o.contribution, "role") };
            },
            (record, o) => {
                if (o.action !== "update")
                    return invalid(
                        "contributions",
                        "Expected an update operation.",
                    );
                return CandidateContributionSchema.parse(
                    patch(record, o.changes),
                );
            },
        );
        operations(
            candidate.plan.relationships,
            changes.relationships ?? [],
            (o) => o.id,
            (o) =>
                o.action === "add" ? createdIds[o.relationship.ref]! : o.id,
            "relationships",
            (o) => {
                if (o.action !== "add")
                    return invalid(
                        "relationships",
                        "Expected an add operation.",
                    );
                const {
                    ref,
                    source_ref,
                    source_id,
                    target_ref,
                    target_id,
                    ...record
                } = o.relationship;
                return {
                    ...record,
                    id: createdIds[ref]!,
                    source_id: resolve(o.relationship, "source"),
                    target_id: resolve(o.relationship, "target"),
                };
            },
            (record, o) => {
                if (o.action !== "update")
                    return invalid(
                        "relationships",
                        "Expected an update operation.",
                    );
                const {
                    source_ref,
                    source_id,
                    target_ref,
                    target_id,
                    ...fields
                } = o.changes;
                return CandidateRelationshipSchema.parse(
                    patch(record, {
                        ...fields,
                        ...(source_ref !== undefined || source_id !== undefined
                            ? { source_id: resolve(o.changes, "source") }
                            : {}),
                        ...(target_ref !== undefined || target_id !== undefined
                            ? { target_id: resolve(o.changes, "target") }
                            : {}),
                    }),
                );
            },
        );
    }
    if (changes.plan === null) {
        if (
            candidate.plan &&
            (candidate.plan.nodes.length ||
                candidate.plan.contributions.length ||
                candidate.plan.relationships.length)
        )
            invalid(
                "changes.plan",
                "Remove/reconcile all graph records explicitly before clearing the plan.",
            );
        candidate.plan = null;
    }
    validateDeckCandidateState(candidate);
    const selectedInputs = (value: DeckCandidateState) =>
        value.memberships
            .map((m) => ({
                card_identity_id: m.card_identity_id,
                section: m.section,
                quantity: m.quantity,
            }))
            .sort((a, b) => membershipKey(a).localeCompare(membershipKey(b)));
    if (
        JSON.stringify(selectedInputs(candidate)) !==
        JSON.stringify(selectedInputs(baseline))
    )
        candidate.selectedChangedAt = now;
    if (JSON.stringify(candidate.brief) !== JSON.stringify(baseline.brief))
        candidate.briefChangedAt = now;
    if (
        JSON.stringify(candidate.plan) !== JSON.stringify(baseline.plan) ||
        JSON.stringify(candidate.options) !==
            JSON.stringify(baseline.options) ||
        JSON.stringify(candidate.assessments) !==
            JSON.stringify(baseline.assessments)
    )
        candidate.planChangedAt = now;
    candidate.updatedAt = now;
    return {
        candidate,
        createdIds,
        changedReferences: [
            ...Object.keys(changes).filter((key) => {
                if (key === "label") return candidate.label !== baseline.label;
                if (key === "brief")
                    return (
                        JSON.stringify(candidate.brief) !==
                        JSON.stringify(baseline.brief)
                    );
                if (key === "plan")
                    return (
                        candidate.plan?.description !==
                        baseline.plan?.description
                    );
                if (key === "assessments")
                    return (
                        JSON.stringify(candidate.assessments) !==
                        JSON.stringify(baseline.assessments)
                    );
                return false;
            }),
            ...changedReferences,
        ],
    };
}
export function validateDeckCandidateState(
    candidate: DeckCandidateState,
): void {
    duplicate(
        candidate.options.map((o) => o.card_identity_id),
        "options",
    );
    duplicate(candidate.memberships.map(membershipKey), "memberships");
    const options = new Set(candidate.options.map((o) => o.card_identity_id));
    const nodes = new Map(candidate.plan?.nodes.map((n) => [n.id, n]));
    const contributions = candidate.plan?.contributions ?? [];
    for (const membership of candidate.memberships)
        if (!options.has(membership.card_identity_id))
            invalid(
                "memberships",
                `Selected Card Identity ${membership.card_identity_id} requires its candidate-owned option.`,
            );
    duplicate(contributions.map(contributionKey), "contributions");
    for (const contribution of contributions) {
        CandidateContributionSchema.parse(contribution);
        if (!options.has(contribution.card_identity_id))
            invalid(
                "contributions.card_identity_id",
                `Unknown candidate option ${contribution.card_identity_id}.`,
            );
        if (nodes.get(contribution.role_id)?.kind !== "role")
            invalid(
                "contributions.role_id",
                `Expected a candidate-owned role: ${contribution.role_id}.`,
            );
    }
    for (const option of candidate.options)
        if (
            !contributions.some(
                (c) => c.card_identity_id === option.card_identity_id,
            )
        )
            invalid(
                "options",
                `Option ${option.card_identity_id} requires at least one reasoned contribution.`,
            );
    for (const node of nodes.values()) {
        CandidateNodeSchema.parse(node);
        if (
            node.kind === "role" &&
            roleSelectedCopies(candidate, node) === 0 &&
            !node.coverage_assessment?.summary
        )
            invalid(
                `nodes.${node.id}.coverage_assessment.summary`,
                "A desired role with zero selected contributors requires a gap explanation.",
            );
    }
    const relationshipKeys: string[] = [];
    for (const relationship of candidate.plan?.relationships ?? []) {
        CandidateRelationshipSchema.parse(relationship);
        const source = nodes.get(relationship.source_id),
            target = nodes.get(relationship.target_id);
        if (!source || !target)
            invalid(
                "relationships",
                `Unknown/cross-candidate endpoint ${relationship.source_id} / ${relationship.target_id}.`,
            );
        if (
            source.kind !== "role" ||
            (relationship.kind === "competes_with" && target.kind !== "role")
        )
            invalid(
                "relationships",
                "Source must be a role; competition must join two roles.",
            );
        if (source.id === target.id)
            invalid("relationships", "Self-links are not allowed.");
        if (
            relationship.kind === "competes_with" &&
            relationship.source_id > relationship.target_id
        )
            [relationship.source_id, relationship.target_id] = [
                relationship.target_id,
                relationship.source_id,
            ];
        relationshipKeys.push(
            `${relationship.kind}/${relationship.source_id}/${relationship.target_id}`,
        );
    }
    duplicate(relationshipKeys, "relationships");
}
