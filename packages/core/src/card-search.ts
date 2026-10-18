import {collectionRetrievalShape, collectionRequestBindings, prepareCollectionRetrieval, CollectionRetrievalFailure, type CollectionRetrievalSession, type CollectionRetrievalDependencies} from "./collection-retrieval";
import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {
    CardSelectionSchema,
    compactJsonBytes,
    decodeRetrievalCursor,
    encodeRetrievalCursor,
    printingFacts,
    retrievalResponseBudgetBytes,
    retrievalScanDeadlineMs,
    type CardFact,
    type CardLookupRepository,
    type CardResult,
    type CardSelection,
    type RetrievalEnvelope,
    type RetrievalProblem,
    type RetrievalSuccess,
    type RetrievalToolError,
} from "./card-retrieval";
import {
    CardIdentityLayoutSchema,
    requiredScryfallImportContractRevisions,
} from "./scryfall-sync";
import type {Logger} from "./logging";

export const SearchCardsArgsSchema = z.strictObject({
    ...collectionRetrievalShape,
    q: z.string().min(1),
    unique: z.enum(["cards", "art", "prints"]).optional(),
    order: z
        .enum([
            "name",
            "set",
            "released",
            "rarity",
            "color",
            "usd",
            "tix",
            "eur",
            "cmc",
            "power",
            "toughness",
            "edhrec",
            "penny",
            "artist",
            "review",
        ])
        .optional(),
    dir: z.enum(["auto", "asc", "desc"]).optional(),
    include_extras: z.boolean().optional(),
    include_multilingual: z.boolean().optional(),
    include_variations: z.boolean().optional(),
    select: CardSelectionSchema,
    first: z.number().int().min(0).max(200).optional(),
    after: z.string().min(1).optional(),
    include_provenance: z.boolean().optional(),
});
export type ProviderReply = {
    status: number;
    body: unknown;
    retryAfterMs?: number;
};
export type CardSearchProvider = {
    id: string;
    dispatch(
        url: string,
        context: {
            remainingMs: number;
            signal?: AbortSignal | undefined;
            correlationId?: string;
            scanBudgetMs?: number;
        },
    ): Promise<ProviderReply>;
};
export type CardSearchOptions = {
    provider: CardSearchProvider;
    collection?: CollectionRetrievalDependencies | undefined;
    now?: () => number;
    scanDeadlineMs?: number;
    responseBudgetBytes?: number;
    log?: Logger;
};
export class ProviderFailure extends Error {
    constructor(readonly problem: RetrievalProblem) {
        super(problem.message);
    }
}
const positionSchema = z.strictObject({
    url: z.string(),
    page: z.number().int().positive(),
    atPageEnd: z.boolean(),
    lastId: z.string().min(1).nullable(),
    nextPage: z.string().nullable(),
});
type Position = z.infer<typeof positionSchema>;
const endpoint = "https://api.scryfall.com/cards/search";
const controls = [
    "q",
    "unique",
    "order",
    "dir",
    "include_extras",
    "include_multilingual",
    "include_variations",
] as const;
/** Source addresses never provide a general network capability. The exact supplied next_page is retained. */
export function validateSearchPageUrl(
    raw: string,
    bindings: Record<string, unknown>,
    page?: number,
): boolean {
    try {
        const url = new URL(raw);
        return (
            url.origin + url.pathname === endpoint &&
            !url.username &&
            !url.password &&
            !url.hash &&
            [...url.searchParams.keys()].every((key) =>
                [...controls, "page", "format", "pretty"].includes(key as any),
            ) &&
            controls.every((key) => url.searchParams.getAll(key).length <= 1) &&
            url.searchParams.getAll("page").length <= 1 &&
            (!url.searchParams.has("page") ||
                /^[1-9]\d*$/.test(url.searchParams.get("page")!)) &&
            (!url.searchParams.has("format") ||
                url.searchParams.get("format") === "json") &&
            (page === undefined ||
                Number(url.searchParams.get("page") ?? 1) === page) &&
            controls.every(
                (key) =>
                    bindings[key] === undefined ||
                    (url.searchParams.getAll(key).length === 1 &&
                        url.searchParams.get(key) === String(bindings[key])),
            )
        );
    } catch {
        return false;
    }
}
export async function searchCards(
    repository: CardLookupRepository,
    input: unknown,
    options: CardSearchOptions,
    signal?: AbortSignal,
): Promise<
    Result<RetrievalSuccess<CardResult>, RetrievalToolError<CardResult>>
> {
    const now = options.now ?? (() => performance.now()),
        started = now(),
        deadline = options.scanDeadlineMs ?? retrievalScanDeadlineMs,
        budget = options.responseBudgetBytes ?? retrievalResponseBudgetBytes;
    const correlationId = crypto.randomUUID();
    const log = options.log?.child({tool: "search_cards", correlationId});
    const parsed = SearchCardsArgsSchema.safeParse(input),
        first = parsed.success ? (parsed.data.first ?? 175) : 175;
    let edges: {node: CardResult}[] = [],
        positions: Position[] = [],
        before: Position[] = [],
        providerTotal: number | null = null,
        providerCalls = 0,
        providerPages = 0,
        rawCount = 0,
        httpMs = 0,
        projectionMs = 0,
        localMs = 0;
    let collection: CollectionRetrievalSession | undefined;
    let revisions: Record<string, string | null> = {},
        provenance: RetrievalEnvelope<CardResult>["provenance"];
    let safe: Position = {
        url: endpoint,
        page: 1,
        atPageEnd: false,
        lastId: null,
        nextPage: null,
    };
    let bindings: Record<string, unknown> = {},
        hasPreviousPage = false;
    const metadata = () => ({
        requested_count: first,
        returned_count: edges.length,
        response_budget_bytes: budget,
        provider_total: providerTotal,
        scoped_total: null,
    });
    const token = (pos: Position) =>
        encodeRetrievalCursor({
            version: 1,
            tool: "search_cards",
            source: options.provider.id,
            bindings,
            revisions,
            position: pos,
        });
    const failure = (
        error: RetrievalProblem,
    ): RetrievalEnvelope<CardResult> => ({
        status: "error",
        edges: [...edges],
        error,
        metadata: metadata(),
        ...(provenance ? {provenance} : {}),
        ...(collection ? {collection_context: collection.context} : {}),
    });
    const minimumPositionBytes = (pos: Position) =>
        compactJsonBytes({
            status: "error",
            edges: [],
            error: {
                code: "scan_timeout",
                message: "Search deadline reached.",
                retryable: true,
                cursor: token(pos),
            },
            metadata: {...metadata(), returned_count: 0},
            ...(parsed.success && parsed.data.include_provenance
                ? {
                      provenance: {
                          ...provenance,
                          reference_imports:
                              provenance?.reference_imports ?? [],
                          provider: provenance?.provider ?? {
                              name: options.provider.id,
                              retrieved_at: "2000-01-01T00:00:00.000Z",
                          },
                      },
                  }
                : {}),
        });
    const ensurePosition = (pos: Position) => {
        const bytes = minimumPositionBytes(pos);
        if (bytes > budget)
            throw new ProviderFailure({
                code: "cursor_too_large",
                message:
                    "Supplied source position exceeds the response budget.",
                retryable: false,
                required_bytes: bytes,
                limit_bytes: budget,
            });
    };
    const page = (
        more: boolean,
        reason: RetrievalSuccess<CardResult>["stop_reason"],
    ): RetrievalSuccess<CardResult> => ({
        status: "ok",
        edges: [...edges],
        pageInfo: {
            startCursor: positions[0] ? token(positions[0]) : null,
            endCursor: positions.at(-1) ? token(positions.at(-1)!) : null,
            hasNextPage: more,
            hasPreviousPage,
        },
        stop_reason: reason,
        metadata: metadata(),
        ...(provenance ? {provenance} : {}),
        ...(collection ? {collection_context: collection.context} : {}),
    });
    const recover = (
        problem: RetrievalProblem,
    ): RetrievalEnvelope<CardResult> => {
        let response = failure({...problem, cursor: token(safe)});
        while (compactJsonBytes(response) > budget && edges.length) {
            safe = before.pop()!;
            edges.pop();
            positions.pop();
            response = failure({...problem, cursor: token(safe)});
        }
        if (compactJsonBytes(response) > budget) {
            provenance = undefined;
            response = failure({
                code: "cursor_too_large",
                message:
                    "Self-contained recovery position exceeds the response budget.",
                retryable: false,
                required_bytes: compactJsonBytes(response),
                limit_bytes: budget,
            });
        }
        return response;
    };
    const finish = (response: RetrievalEnvelope<CardResult>) => {
        const serialization = now(),
            bytes = compactJsonBytes(response);
        if (bytes > budget)
            throw new Error(
                "Adapter capacity cannot carry a minimal structured search error.",
            );
        log?.info(
            {
                operation: "search_cards",
                status: response.status,
                selectedFields: parsed.success
                    ? Object.keys(parsed.data.select)
                    : [],
                providerDispatchAttempts: providerCalls,
                providerPages,
                rawCount,
                returnedCount: edges.length,
                outputBytes: bytes,
                providerStageMs: httpMs,
                projectionMs,
                localMs,
                finalSerializationMs: now() - serialization,
                durationMs: now() - started,
                ...(response.status === "error"
                    ? {
                          errorCode: response.error.code,
                          requiredBytes: response.error.required_bytes,
                          limitBytes: response.error.limit_bytes,
                          recovery: !!response.error.cursor,
                      }
                    : {
                          stopReason: response.stop_reason,
                          recovery: response.pageInfo.hasNextPage,
                      }),
            },
            "Provider search completed",
        );
        log?.debug(
            {
                q: bindings.q,
                after: parsed.success ? parsed.data.after : undefined,
                safePosition: safe,
                cursorVersion: 1,
                cursors:
                    response.status === "error"
                        ? response.error.cursor
                        : response.pageInfo,
                revisions,
            },
            "Search continuation positions",
        );
        return response.status === "error"
            ? err({
                  type: "retrieval_error" as const,
                  message: response.error.message,
                  envelope: response,
              })
            : ok(response);
    };
    if (!parsed.success)
        return finish(
            failure({
                code: "invalid_request",
                message:
                    "Invalid search request; use explicit supported selectors and native controls.",
                retryable: false,
            }),
        );
    const args = parsed.data;
    bindings = {
        ...Object.fromEntries(
            controls
                .filter((key) => args[key] !== undefined)
                .map((key) => [key, args[key]]),
        ),
        include_provenance: args.include_provenance ?? false,
        ...collectionRequestBindings(args),
    };
    const initial = new URL(endpoint);
    for (const key of controls)
        if (args[key] !== undefined)
            initial.searchParams.set(key, String(args[key]));
    safe.url = initial.href;
    if (args.after) {
        const decoded = decodeRetrievalCursor(args.after);
        if (decoded.problem) return finish(failure(decoded.problem));
        const c = decoded.cursor!,
            reason =
                c.tool !== "search_cards"
                    ? "tool_mismatch"
                    : c.source !== options.provider.id
                      ? "provider_mismatch"
                      : JSON.stringify(c.bindings) !== JSON.stringify(bindings)
                        ? "query_mismatch"
                        : null;
        if (reason)
            return finish(
                failure({
                    code: "invalid_cursor",
                    message: "Cursor does not match the search request.",
                    retryable: false,
                    reason,
                }),
            );
        const pos = positionSchema.safeParse(c.position);
        if (
            !pos.success ||
            !validateSearchPageUrl(pos.data.url, bindings, pos.data.page) ||
            (pos.data.nextPage !== null &&
                !validateSearchPageUrl(
                    pos.data.nextPage,
                    bindings,
                    pos.data.page + 1,
                )) ||
            (pos.data.atPageEnd &&
                pos.data.lastId === null &&
                pos.data.page < 1) ||
            Object.keys(c.revisions).some(
                (key) => !["oracle_cards", "oracle_tags", "all_cards", "collection", "collection_policy"].includes(key),
            )
        )
            return finish(
                failure({
                    code: "invalid_cursor",
                    message: "Malformed provider position.",
                    retryable: false,
                    reason: "malformed",
                }),
            );
        safe = pos.data;
        revisions = c.revisions;
        hasPreviousPage = true;
    }
    try {
        collection = await prepareCollectionRetrieval(args, options.collection, args.after ? revisions : undefined);
        Object.assign(revisions, collection?.revisions);
    } catch (e) {
        if (e instanceof CollectionRetrievalFailure) return finish(failure(e.problem));
        throw e;
    }
    const localSnapshot = async (ids: string[]) => {
        const t = now();
        try {
            return await repository.readSnapshot(
                ids.map((value) => ({kind: "oracle_id" as const, value})),
                !!args.select.tags,
            );
        } finally {
            localMs += now() - t;
        }
    };
    let tagUnavailable: string | undefined;
    const readRevisions = async () => {
        const snapshot = await localSnapshot([]);
        if (snapshot.isErr())
            throw new ProviderFailure({
                code: "local_error",
                message: snapshot.error.message,
                retryable: false,
            });
        const imports = new Map<
            string,
            (typeof snapshot.value.imports)[number]
        >();
        for (const item of [...snapshot.value.imports]
            .filter((i) => i.status === "succeeded")
            .sort(
                (a, b) =>
                    (a.completedAt ?? a.startedAt).getTime() -
                        (b.completedAt ?? b.startedAt).getTime() ||
                    a.id.localeCompare(b.id),
            ))
            imports.set(item.bulkDataType, item);
        for (const [dataset, revision] of Object.entries(revisions).filter(([key]) => !["collection", "collection_policy"].includes(key)))
            if (revision !== (imports.get(dataset)?.id ?? null))
                throw new ProviderFailure({
                    code: "stale_cursor",
                    message:
                        "A bound local enrichment import changed. Restart search.",
                    reason: "reference_import_changed",
                    recovery: "restart",
                    retryable: false,
                });
        const tag = imports.get("oracle_tags"),
            oracle = imports.get("oracle_cards");
        if (args.select.tags) {
            revisions.oracle_tags = tag?.id ?? null;
            if (!tag) tagUnavailable = "dataset_not_imported";
            else if (
                tag.importContractRevision !==
                requiredScryfallImportContractRevisions.oracle_tags
            )
                tagUnavailable = "dataset_incompatible";
            else {
                revisions.oracle_cards = oracle?.id ?? null;
                if (!oracle) tagUnavailable = "dataset_not_imported";
                else if (
                    oracle.importContractRevision !==
                    requiredScryfallImportContractRevisions.oracle_cards
                )
                    tagUnavailable = "dataset_incompatible";
            }
        }
        if (args.include_provenance)
            provenance = {
                ...provenance,
                reference_imports: Object.keys(revisions).flatMap((dataset) => {
                    const item = imports.get(dataset);
                    return item
                        ? [
                              {
                                  dataset,
                                  import_id: item.id,
                                  completed_at:
                                      item.completedAt?.toISOString() ?? null,
                                  source_updated_at:
                                      item.sourceUpdatedAt?.toISOString() ??
                                      null,
                              },
                          ]
                        : [];
                }),
            };
    };
    try {
        if (args.select.tags || Object.keys(revisions).length)
            await readRevisions();
    } catch (e) {
        return finish(failure((e as ProviderFailure).problem));
    }
    if (minimumPositionBytes(safe) > budget)
        return finish(
            failure({
                code: "cursor_too_large",
                message:
                    "Self-contained continuation exceeds the response budget.",
                retryable: false,
                limit_bytes: budget,
            }),
        );
    const check = () => {
        if (signal?.aborted)
            throw new ProviderFailure({
                code: "cancelled",
                message: "Search cancelled.",
                retryable: true,
            });
        if (now() - started >= deadline)
            throw new ProviderFailure({
                code: "scan_timeout",
                message: "Search deadline reached.",
                retryable: true,
            });
    };
    const finalize = async (
        more: boolean,
        stop: RetrievalSuccess<CardResult>["stop_reason"],
    ) => {
        check();
        if (Object.keys(revisions).length) await readRevisions();
        await collection?.assertCurrent();
        check();
        return finish(page(more, stop));
    };
    try {
        while (true) {
            check();
            if (safe.atPageEnd) {
                if (!safe.nextPage)
                    return await finalize(false, "source_exhausted");
                safe = {
                    url: safe.nextPage,
                    page: safe.page + 1,
                    atPageEnd: false,
                    lastId: null,
                    nextPage: null,
                };
            }
            const t = now();
            providerCalls++;
            const reply = await options.provider.dispatch(safe.url, {
                remainingMs: Math.max(0, deadline - (now() - started)),
                signal,
                correlationId,
                scanBudgetMs: deadline,
            });
            httpMs += now() - t;
            if (args.include_provenance)
                provenance = {
                    ...provenance,
                    reference_imports: provenance?.reference_imports ?? [],
                    provider: {
                        name: options.provider.id,
                        retrieved_at: new Date().toISOString(),
                    },
                };
            check();
            if (reply.status === 429)
                throw new ProviderFailure({
                    code: "rate_limited",
                    message: "Provider rate limit; wait before retrying.",
                    retryable: true,
                    retry_after_ms: reply.retryAfterMs ?? 31_000,
                });
            if (reply.status === 404 && safe.page === 1 && !safe.lastId)
                return await finalize(false, "source_exhausted");
            if (reply.status !== 200)
                throw new ProviderFailure({
                    code: "provider_error",
                    message:
                        reply.status === 400
                            ? "Provider rejected the query."
                            : "Provider request failed.",
                    reason:
                        reply.status === 400
                            ? "invalid_query"
                            : "transport_failure",
                    retryable: reply.status !== 400,
                });
            const body = reply.body as {
                object?: unknown;
                data?: unknown;
                has_more?: unknown;
                next_page?: unknown;
                total_cards?: unknown;
            };
            if (
                !body ||
                body.object !== "list" ||
                !Array.isArray(body.data) ||
                typeof body.has_more !== "boolean" ||
                (body.has_more &&
                    (typeof body.next_page !== "string" ||
                        !validateSearchPageUrl(
                            body.next_page,
                            bindings,
                            safe.page + 1,
                        )))
            )
                throw new ProviderFailure({
                    code: "provider_error",
                    message: "Invalid provider page.",
                    reason: "invalid_response",
                    retryable: false,
                });
            providerTotal =
                typeof body.total_cards === "number" &&
                Number.isInteger(body.total_cards) &&
                body.total_cards >= 0
                    ? body.total_cards
                    : null;
            providerPages++;
            const data = body.data as Record<string, unknown>[],
                nextPage = body.has_more ? (body.next_page as string) : null;
            let start = 0;
            if (safe.lastId !== null) {
                const indices = data.flatMap((card, i) =>
                    card?.id === safe.lastId ? [i] : [],
                );
                if (indices.length !== 1)
                    throw new ProviderFailure({
                        code: indices.length
                            ? "provider_error"
                            : "cursor_anchor_not_found",
                        message: indices.length
                            ? "Provider page repeats the continuation anchor."
                            : "Continuation anchor is absent from its page. Restart search.",
                        ...(indices.length ? {reason: "duplicate_anchor"} : {}),
                        retryable: false,
                    });
                start = indices[0]! + 1;
            }
            for (let i = start; i < data.length; i++) {
                check();
                const raw = data[i]!;
                rawCount++;
                const prior = {...safe};
                const projectionStart = now();
                const node = projectProviderCard(raw, args.select);
                projectionMs += now() - projectionStart;
                check();
                if (args.select.tags && !tagUnavailable) {
                    const snapshot = await localSnapshot([node.card.oracle_id]);
                    if (snapshot.isErr())
                        throw new ProviderFailure({
                            code: "local_error",
                            message: snapshot.error.message,
                            retryable: false,
                        });
                    const record = snapshot.value.records[0];
                    if (record)
                        node.card.tags = record.tags ?? {
                            direct: [],
                            inherited: [],
                        };
                    else
                        node.unavailable_fields = {
                            tags: "identity_not_in_local_reference_data",
                        };
                }
                if (args.select.tags && tagUnavailable)
                    node.unavailable_fields = {tags: tagUnavailable};
                const matches = collection ? await collection.evaluate(node, raw.id as string, check) : true;
                check();
                if (matches && edges.length === first)
                    return await finalize(true, "first");
                const consumed: Position = {
                    url: safe.url,
                    page: safe.page,
                    atPageEnd: i === data.length - 1,
                    lastId: raw.id as string,
                    nextPage: i === data.length - 1 ? nextPage : null,
                };
                ensurePosition(consumed);
                if (!matches) {safe = consumed; continue;}
                before.push(prior);
                positions.push(consumed);
                edges.push({node});
                safe = consumed;
                if (compactJsonBytes(page(true, "response_budget")) > budget) {
                    edges.pop();
                    positions.pop();
                    before.pop();
                    safe = prior;
                    const retained = edges,
                        retainedPositions = positions;
                    edges = [{node}];
                    positions = [consumed];
                    const bytes = compactJsonBytes(
                        page(true, "response_budget"),
                    );
                    edges = retained;
                    positions = retainedPositions;
                    if (bytes > budget)
                        throw new ProviderFailure({
                            code: "record_too_large",
                            message:
                                "A complete card exceeds the response budget.",
                            retryable: false,
                            required_bytes: bytes,
                            limit_bytes: budget,
                        });
                    return await finalize(true, "response_budget");
                }
            }
            const completed = {...safe, atPageEnd: true, nextPage};
            ensurePosition(completed);
            safe = completed;
        }
    } catch (e) {
        let consistencyError: CollectionRetrievalFailure | undefined;
        try { await collection?.assertCurrent(); if (Object.keys(revisions).length) await readRevisions(); } catch (error) { if (error instanceof CollectionRetrievalFailure || error instanceof ProviderFailure) consistencyError = new CollectionRetrievalFailure(error.problem); else throw error; }
        const problem = consistencyError?.problem ?? (
            e instanceof ProviderFailure || e instanceof CollectionRetrievalFailure
                ? e.problem
                : {
                      code: "provider_error" as const,
                      message: "Provider transport failed.",
                      reason: "transport_failure",
                      retryable: true,
                  });
        if (problem.code === "stale_cursor") {
            edges = [];
            positions = [];
            return finish(failure(problem));
        }
        return finish(recover(problem));
    }
}
export function projectProviderCard(
    raw: Record<string, unknown>,
    select: CardSelection,
): CardResult {
    const printingLayout =
        raw?.layout === "reversible_card" ? "reversible_card" : "standard";
    if (raw?.layout === "reversible_card") {
        const faces = raw.card_faces;
        if (
            !Array.isArray(faces) ||
            !faces.length ||
            faces.some((face) => !face || typeof face !== "object")
        )
            throw new ProviderFailure({
                code: "unsupported_source_record",
                message: "Reversible card lacks supported identity faces.",
                retryable: false,
            });
        const ids = new Set(
            faces
                .map((face) => face.oracle_id)
                .filter((id) => typeof id === "string" && id.length),
        );
        if (
            ids.size !== 1 ||
            (raw.oracle_id !== undefined && raw.oracle_id !== [...ids][0])
        )
            throw new ProviderFailure({
                code: "unsupported_source_record",
                message: "Reversible card identity is ambiguous.",
                retryable: false,
            });
        const gameplay: Record<string, unknown> = {
            ...raw,
            oracle_id: [...ids][0],
        };
        const selected = new Set([
            "layout",
            ...Object.keys(select)
                .filter(
                    (field) =>
                        !printingFacts.has(field as CardFact) &&
                        !["tags", "card_faces", "oracle_id"].includes(field),
                )
                .map((field) => (field === "mana_value" ? "cmc" : field)),
        ]);
        for (const field of selected) {
            if (field !== "layout" && gameplay[field] !== undefined) continue;
            const values = faces.map((face) => face[field] ?? null);
            if (
                values.some(
                    (value) =>
                        JSON.stringify(value) !== JSON.stringify(values[0]),
                ) ||
                (field === "layout" &&
                    (typeof values[0] !== "string" ||
                        values[0] === "reversible_card"))
            )
                throw new ProviderFailure({
                    code: "unsupported_source_record",
                    message:
                        "Reversible card selected gameplay facts are ambiguous.",
                    retryable: false,
                });
            gameplay[field] = values[0];
        }
        raw = gameplay;
    }
    if (
        !raw ||
        raw.object !== "card" ||
        typeof raw.id !== "string" ||
        !raw.id ||
        typeof raw.oracle_id !== "string" ||
        !raw.oracle_id ||
        !CardIdentityLayoutSchema.safeParse(raw.layout).success
    )
        throw new ProviderFailure({
            code: "unsupported_source_record",
            message:
                "Provider record lacks a supported card identity or layout.",
            retryable: false,
        });
    const card: CardResult["card"] = {oracle_id: raw.oracle_id as string};
    if (Object.keys(select).some((key) => printingFacts.has(key as CardFact)))
        card.printing_id = raw.id;
    for (const field of Object.keys(select) as CardFact[]) {
        if (["oracle_id", "printing_id", "tags", "card_faces"].includes(field))
            continue;
        (card as Record<string, unknown>)[field] =
            field === "mana_value"
                ? (raw.cmc ?? null)
                : field === "printing_layout"
                  ? printingLayout
                  : (raw[field] ?? null);
    }
    if (
        select.card_faces ||
        (select.oracle_text &&
            Array.isArray(raw.card_faces) &&
            raw.card_faces.length)
    ) {
        if (raw.card_faces !== undefined && !Array.isArray(raw.card_faces))
            throw new ProviderFailure({
                code: "unsupported_source_record",
                message: "Malformed provider card faces.",
                retryable: false,
            });
        card.card_faces = (
            (raw.card_faces ?? []) as Record<string, unknown>[]
        ).map((face) => {
            if (!face || typeof face !== "object")
                throw new ProviderFailure({
                    code: "unsupported_source_record",
                    message: "Provider face has unsupported content.",
                    retryable: false,
                });
            return Object.fromEntries(
                (select.card_faces
                    ? [
                          "name",
                          "mana_cost",
                          "type_line",
                          "oracle_text",
                          "colors",
                          "color_indicator",
                          "power",
                          "toughness",
                          "loyalty",
                          "defense",
                      ]
                    : ["name", "oracle_text"]
                ).map((key) => [key, face[key] ?? null]),
            );
        });
    }
    for (const [field, value] of Object.entries(card)) {
        if (value === null || field === "card_faces") continue;
        const arrays = [
            "colors",
            "color_identity",
            "color_indicator",
            "produced_mana",
            "keywords",
            "finishes",
            "promo_types",
        ];
        const numeric = [
            "mana_value",
            "edhrec_rank",
            "tcgplayer_id",
            "cardmarket_id",
        ];
        const valid = arrays.includes(field)
            ? Array.isArray(value) &&
              value.every((item) => typeof item === "string")
            : numeric.includes(field)
              ? typeof value === "number" && Number.isFinite(value)
              : field === "game_changer"
                ? typeof value === "boolean"
                : field === "legalities"
                  ? typeof value === "object" &&
                    !Array.isArray(value) &&
                    Object.values(value).every(
                        (item) => typeof item === "string",
                    )
                  : typeof value === "string";
        if (!valid)
            throw new ProviderFailure({
                code: "unsupported_source_record",
                message:
                    "Provider selected fact has an unsupported value shape.",
                retryable: false,
            });
    }
    return {card};
}
