import { randomUUIDv7 } from "bun";
import { and, asc, eq } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import {
    DeckBuildingBriefSchema,
    constructDeckCandidate,
    reviseDeckCandidate,
    summarizeDeckCandidate,
    type CandidateContribution,
    type CandidateNode,
    type CandidateRelationship,
    type CandidateWriteResult,
    type DeckCandidate,
    type DeckCandidateState,
    type DeckCandidateRepository,
    type DeckCandidateRepositoryError,
    checkDependencies, matchingCheckDependencies, candidateValidationEvidence, deckCheckVersions,
    type DeckCheckVersions, type RecordedDeckCheck, type DeckCheckName,
    type DeckBuildingBrief,
    type DeckCandidateCardSection,
} from "@tomekin/core";
import {getDetail, readReferenceSupport} from "./card-reference-repository";
import type { TomekinDatabase } from "./database";
import {
    cardIdentity,
    deckCandidate,
    deckCandidateCard,
    deckCandidatePlan,
    deckCandidateNode,
    deckCandidateOption,
    deckCandidateContribution,
    deckCandidateRelationship,
} from "./schema";
type Store = Pick<TomekinDatabase, "select" | "insert" | "update" | "delete">;
const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
export function createSqliteDeckCandidateRepository(
    db: TomekinDatabase,
    clock: { now(): Date },
    newId: () => string = randomUUIDv7,
    versions: DeckCheckVersions = deckCheckVersions,
): DeckCandidateRepository {
    return {
        async createDeckCandidate(input) {
            return wrap(() =>
                db.transaction(
                    (tx) => {
                        const now = clock.now().toISOString(),
                            id = newId();
                        const result = constructDeckCandidate(
                            input,
                            id,
                            now,
                            newId,
                        );
                        const candidate = result.candidate;
                        tx.insert(deckCandidate)
                            .values({
                                id,
                                label: candidate.label,
                                format: candidate.format,
                                formatAnchor: candidate.formatAnchor,
                                briefJson: candidate.brief,
                                markdown: "",
                                createdAt: new Date(now),
                                updatedAt: new Date(now),
                                createdAtExact: now,
                                updatedAtExact: now,
                                selectedChangedAt: now,
                                briefChangedAt: now,
                                planChangedAt: now,
                                assessmentsJson: candidate.assessments,
                            })
                            .run();
                        persistRecords(tx, candidate, null, newId);
                        return writeResult(
                            candidate,
                            result.createdIds,
                            result.changedReferences,
                            "Created candidate",
                        );
                    },
                    { behavior: "immediate" },
                ),
            );
        },
        async editDeckCandidate(input) {
            return wrap(() =>
                db.transaction(
                    (tx) => {
                        const before = readCandidate(tx, input.candidate_id, versions);
                        if (before.updatedAt !== input.expected_updated_at)
                            throw {
                                type: "conflict",
                                message: `Deck Candidate ${before.id} changed; reload and reconcile before retrying.`,
                                candidate_id: before.id,
                                expected_updated_at: input.expected_updated_at,
                                current_updated_at: before.updatedAt,
                            } satisfies DeckCandidateRepositoryError;
                        const now = new Date(
                            Math.max(
                                clock.now().getTime(),
                                Date.parse(before.updatedAt) + 1,
                            ),
                        ).toISOString();
                        const result = reviseDeckCandidate(
                            before,
                            input,
                            now,
                            newId,
                        );
                        const candidate = result.candidate;
                        tx.update(deckCandidate)
                            .set({
                                label: candidate.label,
                                format: candidate.format,
                                formatAnchor: candidate.formatAnchor,
                                briefJson: candidate.brief,
                                updatedAt: new Date(now),
                                updatedAtExact: now,
                                selectedChangedAt: candidate.selectedChangedAt,
                                briefChangedAt: candidate.briefChangedAt,
                                planChangedAt: candidate.planChangedAt,
                                assessmentsJson: candidate.assessments,
                            })
                            .where(eq(deckCandidate.id, candidate.id))
                            .run();
                        persistRecords(tx, candidate, before, newId);
                        candidate.validation_evidence = readCandidate(tx, candidate.id, versions).validation_evidence!;
                        return writeResult(
                            candidate,
                            result.createdIds,
                            result.changedReferences,
                            "Edited candidate",
                        );
                    },
                    { behavior: "immediate" },
                ),
            );
        },
        async getDeckCandidate(id) {
            return wrap(() => db.transaction((tx) => readCandidate(tx, id, versions)));
        },
        async listDeckCandidates() {
            return wrap(() =>
                db.transaction((tx) =>
                    tx
                        .select({ id: deckCandidate.id })
                        .from(deckCandidate)
                        .orderBy(
                            asc(deckCandidate.label),
                            asc(deckCandidate.id),
                        )
                        .all()
                        .map((row) =>
                            summarizeDeckCandidate(readCandidate(tx, row.id, versions)),
                        ),
                ),
            );
        },
        async captureDeckCheck(input, check) {
            return wrap(() => db.transaction(tx => {
                const now = clock.now().toISOString();
                let candidate:DeckCandidateState|null=null;
                let brief:DeckBuildingBrief;
                let memberships: {cardIdentityId:string;quantity:number;section:DeckCandidateCardSection}[];
                const trial=!("candidate_id" in input) || input.changes !== undefined;
                if("candidate_id" in input) {
                    const saved=readCandidate(tx,input.candidate_id,versions);
                    if(saved.updatedAt!==input.expected_updated_at) {
                        throw {
                            type:"conflict",
                            message:`Deck Candidate ${saved.id} changed; reload before checking.`,
                            candidate_id:saved.id,
                            expected_updated_at:input.expected_updated_at,
                            current_updated_at:saved.updatedAt,
                        } satisfies DeckCandidateRepositoryError;
                    }
                    candidate=input.changes===undefined?saved:reviseDeckCandidate(saved,{
                        candidate_id:input.candidate_id,
                        expected_updated_at:input.expected_updated_at,
                        changes:input.changes,
                    },now,newId).candidate;
                    requireOptionIdentities(tx,candidate);
                    brief=candidate.brief;
                    memberships=candidate.memberships.map(m=>({cardIdentityId:m.card_identity_id,quantity:m.quantity,section:m.section}));
                } else {
                    brief=input.brief;
                    memberships=input.cards;
                }
                // Hydrate the revised memberships, never the baseline's derived cards.
                const cards = memberships.map(m=> {
                    const detail=getDetail(tx,m.cardIdentityId);
                    return {card:detail.identity,quantity:m.quantity,section:m.section,legalities:detail.legalities,parts:detail.parts};
                });
                const reference=readReferenceSupport(tx);
                return {brief,cards,reference,checked_at:now,
                    ...(candidate ? {candidate_id:candidate.id,dependencies:checkDependencies(candidate,check,reference.imports,versions)} : {}),
                    trial,
                };
            }));
        },
        async publishDeckCheck(candidateId, check, evidence) {
            return wrap(() => db.transaction(tx=> {
                const candidate=readCandidate(tx,candidateId,versions);
                const current=checkDependencies(candidate,check,readReferenceSupport(tx).imports,versions);
                if(!matchingCheckDependencies(current,evidence.dependencies)) return "outdated" as const;
                const row=tx.select({evidence:deckCandidate.checkEvidenceJson}).from(deckCandidate).where(eq(deckCandidate.id,candidateId)).get()!;
                tx.update(deckCandidate).set({checkEvidenceJson:{...(row.evidence as object??{}),[check]:evidence}}).where(eq(deckCandidate.id,candidateId)).run();
                return "applicable" as const;
            },{behavior:"immediate"}));
        },
    };
}
function writeResult(
    candidate: DeckCandidateState,
    createdIds: Record<string, string>,
    changedReferences: string[],
    verb: string,
): CandidateWriteResult {
    return {
        candidate_id: candidate.id,
        created_at: candidate.createdAt,
        updated_at: candidate.updatedAt,
        created_ids: createdIds,
        changed_references: changedReferences,
        summary: `${verb}: ${changedReferences.length} targeted record/field changes; ${candidate.options.length} assessed options, ${candidate.memberships.reduce((sum, m) => sum + m.quantity, 0)} selected copies.`,
        validation_evidence:
            summarizeDeckCandidate(candidate).validation_evidence,
    };
}
function persistRecords(
    db: Store,
    candidate: DeckCandidateState,
    before: DeckCandidateState | null,
    newId: () => string,
) {
    const id = candidate.id,
        oldPlan = before?.plan;
    requireOptionIdentities(db,candidate);
    const pair = (value: { card_identity_id: string; role_id: string }) =>
        `${value.card_identity_id}/${value.role_id}`;
    const membership = (value: { card_identity_id: string; section: string }) =>
        `${value.card_identity_id}/${value.section}`;
    // Delete only explicitly removed records, in FK dependency order.
    for (const row of oldPlan?.relationships ?? [])
        if (
            !candidate.plan?.relationships.some(
                (r) => r.id === row.id && same(r, row),
            )
        )
            db.delete(deckCandidateRelationship)
                .where(
                    and(
                        eq(deckCandidateRelationship.candidateId, id),
                        eq(deckCandidateRelationship.id, row.id),
                    ),
                )
                .run();
    for (const row of oldPlan?.contributions ?? [])
        if (!candidate.plan?.contributions.some((r) => pair(r) === pair(row)))
            db.delete(deckCandidateContribution)
                .where(
                    and(
                        eq(deckCandidateContribution.candidateId, id),
                        eq(
                            deckCandidateContribution.cardIdentityId,
                            row.card_identity_id,
                        ),
                        eq(deckCandidateContribution.roleId, row.role_id),
                    ),
                )
                .run();
    for (const row of before?.memberships ?? [])
        if (
            !candidate.memberships.some(
                (r) => membership(r) === membership(row),
            )
        )
            db.delete(deckCandidateCard)
                .where(
                    and(
                        eq(deckCandidateCard.deckCandidateId, id),
                        eq(
                            deckCandidateCard.cardIdentityId,
                            row.card_identity_id,
                        ),
                        eq(deckCandidateCard.section, row.section),
                    ),
                )
                .run();
    for (const row of oldPlan?.nodes ?? [])
        if (!candidate.plan?.nodes.some((r) => r.id === row.id))
            db.delete(deckCandidateNode)
                .where(
                    and(
                        eq(deckCandidateNode.candidateId, id),
                        eq(deckCandidateNode.id, row.id),
                    ),
                )
                .run();
    for (const row of before?.options ?? [])
        if (
            !candidate.options.some(
                (r) => r.card_identity_id === row.card_identity_id,
            )
        )
            db.delete(deckCandidateOption)
                .where(
                    and(
                        eq(deckCandidateOption.candidateId, id),
                        eq(
                            deckCandidateOption.cardIdentityId,
                            row.card_identity_id,
                        ),
                    ),
                )
                .run();
    if (!candidate.plan && oldPlan)
        db.delete(deckCandidatePlan)
            .where(eq(deckCandidatePlan.candidateId, id))
            .run();
    if (candidate.plan) {
        if (!oldPlan)
            db.insert(deckCandidatePlan)
                .values({
                    candidateId: id,
                    description: candidate.plan.description,
                })
                .run();
        else if (candidate.plan.description !== oldPlan.description)
            db.update(deckCandidatePlan)
                .set({ description: candidate.plan.description })
                .where(eq(deckCandidatePlan.candidateId, id))
                .run();
    }
    for (const row of candidate.plan?.nodes ?? []) {
        const prior = oldPlan?.nodes.find((n) => n.id === row.id);
        if (same(prior, row)) continue;
        const values = {
            candidateId: id,
            id: row.id,
            kind: row.kind,
            label: row.label,
            description: row.description,
            priority: row.kind === "win_route" ? row.priority : null,
            rationale: row.kind === "win_route" ? row.rationale : null,
            coverageGoalJson:
                row.kind === "role" ? (row.coverage_goal ?? null) : null,
            coverageAssessmentJson:
                row.kind === "role" ? (row.coverage_assessment ?? null) : null,
            evidenceJson: row.evidence ?? null,
        };
        if (prior)
            db.update(deckCandidateNode)
                .set(values)
                .where(
                    and(
                        eq(deckCandidateNode.candidateId, id),
                        eq(deckCandidateNode.id, row.id),
                    ),
                )
                .run();
        else db.insert(deckCandidateNode).values(values).run();
    }
    for (const row of candidate.options) {
        const prior = before?.options.find(
            (o) => o.card_identity_id === row.card_identity_id,
        );
        if (same(prior, row)) continue;
        const values = {
            candidateId: id,
            cardIdentityId: row.card_identity_id,
            comparisonNote: row.comparison_note ?? null,
        };
        if (prior)
            db.update(deckCandidateOption)
                .set(values)
                .where(
                    and(
                        eq(deckCandidateOption.candidateId, id),
                        eq(
                            deckCandidateOption.cardIdentityId,
                            row.card_identity_id,
                        ),
                    ),
                )
                .run();
        else db.insert(deckCandidateOption).values(values).run();
    }
    for (const row of candidate.plan?.contributions ?? []) {
        const prior = oldPlan?.contributions.find((c) => pair(c) === pair(row));
        if (same(prior, row)) continue;
        const values = {
            candidateId: id,
            cardIdentityId: row.card_identity_id,
            roleId: row.role_id,
            rationale: row.rationale,
            qualificationsJson: row.qualifications ?? null,
            evidenceJson: row.evidence ?? null,
        };
        if (prior)
            db.update(deckCandidateContribution)
                .set(values)
                .where(
                    and(
                        eq(deckCandidateContribution.candidateId, id),
                        eq(
                            deckCandidateContribution.cardIdentityId,
                            row.card_identity_id,
                        ),
                        eq(deckCandidateContribution.roleId, row.role_id),
                    ),
                )
                .run();
        else db.insert(deckCandidateContribution).values(values).run();
    }
    for (const row of candidate.plan?.relationships ?? []) {
        const prior = oldPlan?.relationships.find((r) => r.id === row.id);
        if (same(prior, row)) continue;
        const values = {
            candidateId: id,
            id: row.id,
            kind: row.kind,
            sourceId: row.source_id,
            targetId: row.target_id,
            rationale: row.rationale,
            qualificationsJson: row.qualifications ?? null,
            evidenceJson: row.evidence ?? null,
        };
        db.insert(deckCandidateRelationship).values(values).run();
    }
    for (const row of candidate.memberships) {
        const prior = before?.memberships.find(
            (m) => membership(m) === membership(row),
        );
        if (same(prior, row)) continue;
        const values = {
            deckCandidateId: id,
            cardIdentityId: row.card_identity_id,
            section: row.section,
            quantity: row.quantity,
            sortOrder: row.sort_order ?? 0,
            note: row.note ?? null,
        };
        if (prior)
            db.update(deckCandidateCard)
                .set(values)
                .where(
                    and(
                        eq(deckCandidateCard.deckCandidateId, id),
                        eq(
                            deckCandidateCard.cardIdentityId,
                            row.card_identity_id,
                        ),
                        eq(deckCandidateCard.section, row.section),
                    ),
                )
                .run();
        else
            db.insert(deckCandidateCard)
                .values({ id: newId(), ...values })
                .run();
    }
}
function requireOptionIdentities(db: Store,candidate:DeckCandidateState) {
    for (const option of candidate.options) {
        if (!db.select({id:cardIdentity.id}).from(cardIdentity).where(eq(cardIdentity.id,option.card_identity_id)).get())
            throw {type:"unresolved_card_identity",message:`options.card_identity_id: Unknown Card Identity ${option.card_identity_id}.`} satisfies DeckCandidateRepositoryError;
    }
}
function readCandidate(db: Store, id: string, versions:DeckCheckVersions=deckCheckVersions): DeckCandidate {
    const row = db
        .select()
        .from(deckCandidate)
        .where(eq(deckCandidate.id, id))
        .get();
    if (!row)
        throw {
            type: "not_found",
            message: `Deck Candidate not found: ${id}.`,
            candidate_id: id,
        } satisfies DeckCandidateRepositoryError;
    const brief = DeckBuildingBriefSchema.parse(row.briefJson);
    const plan = db
        .select()
        .from(deckCandidatePlan)
        .where(eq(deckCandidatePlan.candidateId, id))
        .get();
    const options = db
        .select({
            card_identity_id: deckCandidateOption.cardIdentityId,
            comparison_note: deckCandidateOption.comparisonNote,
            card_name: cardIdentity.name,
        })
        .from(deckCandidateOption)
        .innerJoin(
            cardIdentity,
            eq(cardIdentity.id, deckCandidateOption.cardIdentityId),
        )
        .where(eq(deckCandidateOption.candidateId, id))
        .orderBy(asc(cardIdentity.name), asc(cardIdentity.id))
        .all();
    const memberships = db
        .select({
            card_identity_id: deckCandidateCard.cardIdentityId,
            quantity: deckCandidateCard.quantity,
            section: deckCandidateCard.section,
            sort_order: deckCandidateCard.sortOrder,
            note: deckCandidateCard.note,
            card_name: cardIdentity.name,
        })
        .from(deckCandidateCard)
        .innerJoin(
            cardIdentity,
            eq(cardIdentity.id, deckCandidateCard.cardIdentityId),
        )
        .where(eq(deckCandidateCard.deckCandidateId, id))
        .orderBy(
            asc(deckCandidateCard.sortOrder),
            asc(cardIdentity.name),
            asc(cardIdentity.id),
        )
        .all();
    const nodes = plan
        ? db
              .select()
              .from(deckCandidateNode)
              .where(eq(deckCandidateNode.candidateId, id))
              .orderBy(asc(deckCandidateNode.id))
              .all()
              .map(
                  (n) =>
                      ({
                          id: n.id,
                          kind: n.kind,
                          label: n.label,
                          description: n.description,
                          ...(n.kind === "role"
                              ? {
                                    ...(n.coverageGoalJson
                                        ? { coverage_goal: n.coverageGoalJson }
                                        : {}),
                                    ...(n.coverageAssessmentJson
                                        ? {
                                              coverage_assessment:
                                                  n.coverageAssessmentJson,
                                          }
                                        : {}),
                                }
                              : {
                                    priority: n.priority,
                                    rationale: n.rationale,
                                }),
                          ...(n.evidenceJson
                              ? { evidence: n.evidenceJson }
                              : {}),
                      }) as CandidateNode,
              )
        : [];
    const contributions = plan
        ? db
              .select()
              .from(deckCandidateContribution)
              .where(eq(deckCandidateContribution.candidateId, id))
              .orderBy(
                  asc(deckCandidateContribution.cardIdentityId),
                  asc(deckCandidateContribution.roleId),
              )
              .all()
              .map(
                  (c) =>
                      ({
                          card_identity_id: c.cardIdentityId,
                          role_id: c.roleId,
                          rationale: c.rationale,
                          ...(c.qualificationsJson
                              ? { qualifications: c.qualificationsJson }
                              : {}),
                          ...(c.evidenceJson
                              ? { evidence: c.evidenceJson }
                              : {}),
                      }) as CandidateContribution,
              )
        : [];
    const relationships = plan
        ? db
              .select()
              .from(deckCandidateRelationship)
              .where(eq(deckCandidateRelationship.candidateId, id))
              .orderBy(asc(deckCandidateRelationship.id))
              .all()
              .map(
                  (r) =>
                      ({
                          id: r.id,
                          kind: r.kind,
                          source_id: r.sourceId,
                          target_id: r.targetId,
                          rationale: r.rationale,
                          ...(r.qualificationsJson
                              ? { qualifications: r.qualificationsJson }
                              : {}),
                          ...(r.evidenceJson
                              ? { evidence: r.evidenceJson }
                              : {}),
                      }) as CandidateRelationship,
              )
        : [];
    const createdAt = row.createdAtExact ?? row.createdAt.toISOString(),
        updatedAt = row.updatedAtExact ?? row.updatedAt.toISOString();
    const candidate:DeckCandidate = {
        id,
        label: row.label,
        brief,
        format: brief.format,
        formatAnchor: brief.formatAnchor,
        createdAt,
        updatedAt,
        selectedChangedAt: row.selectedChangedAt ?? updatedAt,
        briefChangedAt: row.briefChangedAt ?? updatedAt,
        planChangedAt: row.planChangedAt ?? updatedAt,
        assessments: (row.assessmentsJson ??
            {}) as DeckCandidate["assessments"],
        plan: plan
            ? {
                  schema_version: 1,
                  candidate_id: id,
                  description: plan.description,
                  nodes,
                  contributions,
                  relationships,
              }
            : null,
        options,
        memberships,
        cards: memberships.map((m) => ({
            cardIdentityId: m.card_identity_id,
            cardName: m.card_name,
            quantity: m.quantity,
            section: m.section,
            sortOrder: m.sort_order,
            note: m.note,
        })),
    };
    candidate.validation_evidence=candidateValidationEvidence(candidate,(row.checkEvidenceJson??{}) as Partial<Record<DeckCheckName,RecordedDeckCheck>>,readReferenceSupport(db).imports,versions);
    return candidate;
}
function wrap<T>(fn: () => T): Result<T, DeckCandidateRepositoryError> {
    try {
        return ok(fn());
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "type" in error &&
            "message" in error
        )
            return err(error as DeckCandidateRepositoryError);
        return err({
            type:
                error instanceof Error && error.name === "ZodError"
                    ? "validation_error"
                    : "repository_error",
            message: error instanceof Error ? error.message : String(error),
        });
    }
}
