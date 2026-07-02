import {eq} from "drizzle-orm";
import {err, ok} from "neverthrow";
import type {
    CardIdentity,
    CardIdentityTaggingWeight,
    CardQueryCollectionCardResult,
    CardQueryError,
    CardQueryFilter,
    CardQueryInput,
    CardQueryProperty,
    CardQueryPropertyRef,
    CardQueryRepository,
    CardQueryResult,
    CardQueryResultItem,
    CardQueryScalar,
    CardQueryTagResult,
    CardQueryValue,
    FormatLegality,
} from "@mtg-agent/core";
import {CardIdentitySchema, filterHasCollectionPredicate} from "@mtg-agent/core";
import type {MtgAgentDatabase} from "./database";
import {
    cardIdentity,
    cardIdentityFormatLegality,
    cardIdentityTag,
    cardIdentityTagAlias,
    cardIdentityTagging,
    cardIdentityTagHierarchy,
    cardPrinting,
    collectionCard,
    collectionLocation,
} from "./schema";

type CollectionRow = CardQueryCollectionCardResult & {
    readonly cardIdentityId: string;
};

type DirectTagRow = CardQueryTagResult & {
    readonly cardIdentityId: string;
    readonly aliases: readonly string[];
};

type TagDefinition = Omit<DirectTagRow, "cardIdentityId" | "weight" | "annotation">;

type LegalityRow = {
    readonly cardIdentityId: string;
    readonly format: string;
    readonly legality: FormatLegality;
};

type QueryContext = {
    readonly identity: CardIdentity;
    readonly legalities: readonly LegalityRow[];
    readonly tags: readonly DirectTagRow[];
    readonly collectionRows: readonly CollectionRow[];
    readonly descendantTagIdsByParent: ReadonlyMap<string, ReadonlySet<string>>;
    readonly ancestorTagIdsByChild: ReadonlyMap<string, readonly string[]>;
    readonly tagDefinitionsById: ReadonlyMap<string, TagDefinition>;
};

type FilterResult = {
    readonly matches: boolean;
    readonly collectionRows?: readonly CollectionRow[] | undefined;
};
type AtomicCardQueryFilter = Extract<CardQueryFilter, {
    readonly args: readonly [CardQueryPropertyRef, CardQueryValue]
}>;

export function createSqliteCardQueryRepository(db: MtgAgentDatabase): CardQueryRepository {
    return {
        async queryCards(input) {
            try {
                const contexts = loadContexts(db);
                const hasCollectionPredicate = filterHasCollectionPredicate(input.filter);
                const matched = contexts
                    .map((context) => ({
                        context,
                        result: input.filter ? evaluateFilter(input.filter, context) : {matches: true} satisfies FilterResult
                    }))
                    .filter((entry) => entry.result.matches);
                const sorted = sortMatched(matched, input);
                const limit = input.limit ?? 50;
                return ok({
                    limit,
                    items: sorted.slice(0, limit).map((entry) => toResultItem(entry.context, input, hasCollectionPredicate, entry.result.collectionRows)),
                } satisfies CardQueryResult);
            } catch (error) {
                return err({
                    type: "repository_error",
                    message: error instanceof Error ? error.message : String(error)
                } satisfies CardQueryError);
            }
        },
    };
}

function loadContexts(db: MtgAgentDatabase): readonly QueryContext[] {
    const identities = db.select().from(cardIdentity).all().map((row) => CardIdentitySchema.parse({
        ...row,
        keywords: row.keywordsJson as string[]
    }));
    const legalities = db.select().from(cardIdentityFormatLegality).all() as readonly LegalityRow[];
    const aliasRows = db.select().from(cardIdentityTagAlias).all();
    const aliasesByTag = new Map<string, string[]>();
    for (const row of aliasRows) aliasesByTag.set(row.tagId, [...(aliasesByTag.get(row.tagId) ?? []), row.alias]);
    const tagDefinitionsById = new Map(db.select().from(cardIdentityTag).all().map((row) => [row.id, {
        tagId: row.id,
        slug: row.slug,
        label: row.label,
        aliases: aliasesByTag.get(row.id) ?? [],
    } satisfies TagDefinition]));
    const directTags = db
        .select({
            cardIdentityId: cardIdentityTagging.cardIdentityId,
            tagId: cardIdentityTagging.tagId,
            slug: cardIdentityTag.slug,
            label: cardIdentityTag.label,
            weight: cardIdentityTagging.weight,
            annotation: cardIdentityTagging.annotation,
        })
        .from(cardIdentityTagging)
        .innerJoin(cardIdentityTag, eq(cardIdentityTagging.tagId, cardIdentityTag.id))
        .all()
        .map((row) => ({...row, aliases: aliasesByTag.get(row.tagId) ?? []}) satisfies DirectTagRow);
    const collectionRows = db
        .select({
            collectionCardId: collectionCard.id,
            quantity: collectionCard.quantity,
            finish: collectionCard.finish,
            condition: collectionCard.condition,
            locationId: collectionLocation.id,
            locationName: collectionLocation.name,
            locationType: collectionLocation.type,
            cardIdentityId: cardIdentity.id,
            cardPrintingId: cardPrinting.id,
            printedName: cardPrinting.printedName,
            setCode: cardPrinting.setCode,
            collectorNumber: cardPrinting.collectorNumber,
            language: cardPrinting.language,
            altered: collectionCard.altered,
            misprint: collectionCard.misprint,
        })
        .from(collectionCard)
        .innerJoin(collectionLocation, eq(collectionCard.collectionLocationId, collectionLocation.id))
        .innerJoin(cardPrinting, eq(collectionCard.cardPrintingId, cardPrinting.id))
        .innerJoin(cardIdentity, eq(cardPrinting.cardIdentityId, cardIdentity.id))
        .all() as readonly CollectionRow[];
    const hierarchyRows = db.select().from(cardIdentityTagHierarchy).all();
    const descendantTagIdsByParent = buildDescendantTagMap(hierarchyRows);
    const ancestorTagIdsByChild = buildAncestorTagMap(hierarchyRows);

    return identities.map((identity) => ({
        identity,
        legalities: legalities.filter((row) => row.cardIdentityId === identity.id),
        tags: directTags.filter((row) => row.cardIdentityId === identity.id),
        collectionRows: collectionRows.filter((row) => row.cardIdentityId === identity.id),
        descendantTagIdsByParent,
        ancestorTagIdsByChild,
        tagDefinitionsById,
    }));
}

function evaluateFilter(filter: CardQueryFilter, context: QueryContext, collectionScope?: readonly CollectionRow[]): FilterResult {
    if (filter.op === "and") {
        let scope: readonly CollectionRow[] | undefined = collectionScope;
        for (const child of filter.args.filter((candidate) => !isCollectionQuantityFilter(candidate))) {
            const result = evaluateFilter(child, context, scope);
            if (!result.matches) return {matches: false};
            scope = intersectScopes(scope, result.collectionRows);
        }
        for (const child of filter.args.filter(isCollectionQuantityFilter)) {
            const result = evaluateFilter(child, context, scope);
            if (!result.matches) return {matches: false};
            scope = intersectScopes(scope, result.collectionRows);
        }
        return {matches: true, collectionRows: scope};
    }
    if (filter.op === "or") {
        const results = filter.args.map((child) => evaluateFilter(child, context, collectionScope)).filter((result) => result.matches);
        if (results.length === 0) return {matches: false};
        const scopes = results.map((result) => result.collectionRows).filter((scope): scope is readonly CollectionRow[] => scope !== undefined);
        return {matches: true, collectionRows: scopes.length > 0 ? uniqueRows(scopes.flat()) : collectionScope};
    }
    if (filter.op === "not") return {matches: !evaluateFilter(filter.args[0], context, collectionScope).matches};
    if (filter.op === "withTagging") return {matches: context.tags.some((tag) => evaluateTaggingScope(filter.args[0], tag, context))};
    if (filter.op === "withCollectionCard") return evaluateFilter(filter.args[0], context, collectionScope);

    if (!isAtomicFilter(filter)) return {matches: false};
    const property = filter.args[0].property;
    const value = filter.args[1];
    if (property.startsWith("collection.")) return evaluateCollectionFilter(filter.op, property, value, context, collectionScope);
    return {matches: evaluateReferenceFilter(filter.op, property, value, context)};
}

function evaluateReferenceFilter(op: Exclude<CardQueryFilter["op"], "and" | "or" | "not" | "withTagging" | "withCollectionCard">, property: CardQueryProperty, value: CardQueryScalar | readonly CardQueryScalar[], context: QueryContext): boolean {
    if (op === "contains") return typeof value === "string" && textValue(context, property).toLowerCase().includes(value.toLowerCase());
    if (op === "in") return Array.isArray(value) && value.some((candidate) => evaluateReferenceFilter("=", property, candidate, context));
    if (op === "colorIdentitySubsetOf") return typeof value === "string" && isColorSubset(context.identity.colorIdentity, value);
    if (op === "hasTagInHierarchy") return typeof value === "string" && context.tags.some((tag) => tag.tagId === value || context.descendantTagIdsByParent.get(value)?.has(tag.tagId));
    if (property.startsWith("tag.")) return context.tags.some((tag) => tagValues(tag, property).some((candidate) => compareValues(candidate, op, value as CardQueryScalar)));
    return compareValues(referenceValue(context, property), op, value as CardQueryScalar);
}

function evaluateCollectionFilter(op: Exclude<CardQueryFilter["op"], "and" | "or" | "not" | "withTagging" | "withCollectionCard">, property: CardQueryProperty, value: CardQueryScalar | readonly CardQueryScalar[], context: QueryContext, collectionScope: readonly CollectionRow[] | undefined): FilterResult {
    const inputRows = collectionScope ?? context.collectionRows;
    if (property === "collection.quantity") {
        const quantity = inputRows.reduce((sum, row) => sum + row.quantity, 0);
        return {matches: compareValues(quantity, op, value as CardQueryScalar), collectionRows: inputRows};
    }
    const rows = inputRows.filter((row) => {
        if (op === "in") return Array.isArray(value) && value.some((candidate) => compareValues(collectionValue(row, property), "=", candidate));
        return compareValues(collectionValue(row, property), op, value as CardQueryScalar);
    });
    return {matches: rows.length > 0, collectionRows: rows};
}

function evaluateTaggingScope(filter: CardQueryFilter, tag: DirectTagRow, context: QueryContext): boolean {
    if (filter.op === "and") return filter.args.every((child) => evaluateTaggingScope(child, tag, context));
    if (filter.op === "or") return filter.args.some((child) => evaluateTaggingScope(child, tag, context));
    if (!isAtomicFilter(filter)) return false;

    const property = filter.args[0].property;
    const value = filter.args[1];
    if (filter.op === "hasTagInHierarchy") return typeof value === "string" && (tag.tagId === value || context.descendantTagIdsByParent.get(value)?.has(tag.tagId) === true);
    if (!property.startsWith("tag.")) return false;
    if (filter.op === "in") return Array.isArray(value) && value.some((candidate) => tagValues(tag, property).some((tagValue) => compareValues(tagValue, "=", candidate)));
    return tagValues(tag, property).some((candidate) => compareValues(candidate, filter.op, value as CardQueryScalar));
}

function toResultItem(context: QueryContext, input: CardQueryInput, hasCollectionPredicate: boolean, matchedCollectionRows: readonly CollectionRow[] | undefined): CardQueryResultItem {
    const include = input.include ?? {};
    return {
        id: context.identity.id,
        name: context.identity.name,
        manaCost: context.identity.manaCost,
        manaValue: context.identity.manaValue,
        typeLine: context.identity.typeLine,
        oracleText: truncateOracleText(context.identity.oracleText),
        colorIdentity: context.identity.colorIdentity,
        gameChanger: context.identity.gameChanger,
        edhrecRank: context.identity.edhrecRank,
        ...(include.legalities ? {legalities: Object.fromEntries(context.legalities.filter((row) => include.legalities?.includes(row.format as "commander")).map((row) => [row.format, row.legality])) as Partial<Record<"commander", FormatLegality>>} : {}),
        ...(include.tags ? {
            tags: {
                direct: sortTags(context.tags.map(toTagResult)),
                inherits: inheritedTags(context)
            }
        } : {}),
        ...(include.collectionCards ? {collectionCards: (hasCollectionPredicate ? matchedCollectionRows ?? [] : context.collectionRows).map(toCollectionResult)} : {}),
    };
}

function sortMatched(entries: readonly {
    readonly context: QueryContext;
    readonly result: FilterResult
}[], input: CardQueryInput): readonly { readonly context: QueryContext; readonly result: FilterResult }[] {
    const sortby = input.sortby ?? [{property: "identity.id" as const, direction: "asc" as const}];
    return [...entries].sort((left, right) => {
        for (const sort of sortby) {
            const comparison = compareSortValue(sortValue(left, sort.property, input), sortValue(right, sort.property, input), sort.direction);
            if (comparison !== 0) return comparison;
        }
        return left.context.identity.id.localeCompare(right.context.identity.id);
    });
}

function sortValue(entry: {
    readonly context: QueryContext;
    readonly result: FilterResult
}, property: string, input: CardQueryInput): string | number | boolean | null {
    if (property === "collection.quantity") {
        const rows = filterHasCollectionPredicate(input.filter) ? entry.result.collectionRows ?? [] : entry.context.collectionRows;
        return rows.reduce((sum, row) => sum + row.quantity, 0);
    }
    return referenceValue(entry.context, property as CardQueryProperty);
}

function referenceValue(context: QueryContext, property: CardQueryProperty): string | number | boolean | null {
    if (property === "identity.id") return context.identity.id;
    if (property === "identity.name") return context.identity.name;
    if (property === "identity.typeLine") return context.identity.typeLine;
    if (property === "identity.oracleText") return context.identity.oracleText;
    if (property === "identity.manaValue") return context.identity.manaValue;
    if (property === "identity.colorIdentity") return context.identity.colorIdentity;
    if (property === "identity.colors") return context.identity.colors;
    if (property === "identity.gameChanger") return context.identity.gameChanger;
    if (property === "identity.edhrecRank") return context.identity.edhrecRank;
    if (property === "legality.commander") return context.legalities.find((row) => row.format === "commander")?.legality ?? null;
    if (property === "tag.id") return context.tags[0]?.tagId ?? null;
    if (property === "tag.slug") return context.tags[0]?.slug ?? null;
    if (property === "tag.label") return context.tags[0]?.label ?? null;
    if (property === "tag.alias") return context.tags.flatMap((tag) => tag.aliases)[0] ?? null;
    if (property === "tag.weight") return context.tags[0]?.weight ?? null;
    return null;
}

function textValue(context: QueryContext, property: CardQueryProperty): string {
    const value = referenceValue(context, property);
    return typeof value === "string" ? value : "";
}

function collectionValue(row: CollectionRow, property: CardQueryProperty): string | number | boolean | null {
    if (property === "collection.locationName") return row.locationName;
    if (property === "collection.locationType") return row.locationType;
    if (property === "collection.finish") return row.finish;
    if (property === "collection.altered") return row.altered;
    if (property === "collection.misprint") return row.misprint;
    if (property === "collection.quantity") return row.quantity;
    return null;
}

function tagValues(row: DirectTagRow, property: CardQueryProperty): readonly (string | CardIdentityTaggingWeight)[] {
    if (property === "tag.id") return [row.tagId];
    if (property === "tag.slug") return [row.slug];
    if (property === "tag.label") return [row.label];
    if (property === "tag.alias") return row.aliases;
    if (property === "tag.weight") return [row.weight];
    return [];
}

function compareValues(left: string | number | boolean | null, op: string, right: CardQueryScalar): boolean {
    if (left === null) return false;
    if (op === "=") return left === right;
    if (op === "!=") return left !== right;
    if (typeof left !== "number" || typeof right !== "number") return false;
    if (op === "<") return left < right;
    if (op === "<=") return left <= right;
    if (op === ">") return left > right;
    if (op === ">=") return left >= right;
    return false;
}

function compareSortValue(left: string | number | boolean | null, right: string | number | boolean | null, direction: "asc" | "desc"): number {
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return direction === "asc" ? comparison : -comparison;
}

function isCollectionQuantityFilter(filter: CardQueryFilter): boolean {
    return isAtomicFilter(filter) && filter.args[0].property === "collection.quantity";
}

function isAtomicFilter(filter: CardQueryFilter): filter is AtomicCardQueryFilter {
    return filter.op !== "and" && filter.op !== "or" && filter.op !== "not" && filter.op !== "withTagging" && filter.op !== "withCollectionCard";
}

function intersectScopes(left: readonly CollectionRow[] | undefined, right: readonly CollectionRow[] | undefined): readonly CollectionRow[] | undefined {
    if (left === undefined) return right;
    if (right === undefined) return left;
    const rightIds = new Set(right.map((row) => row.collectionCardId));
    return left.filter((row) => rightIds.has(row.collectionCardId));
}

function uniqueRows(rows: readonly CollectionRow[]): readonly CollectionRow[] {
    return [...new Map(rows.map((row) => [row.collectionCardId, row])).values()];
}

function toTagResult(row: DirectTagRow): CardQueryTagResult {
    return {tagId: row.tagId, slug: row.slug, label: row.label, weight: row.weight, annotation: row.annotation};
}

function inheritedTags(context: QueryContext): readonly CardQueryTagResult[] {
    const directTagIds = new Set(context.tags.map((tag) => tag.tagId));
    const inheritedByTagId = new Map<string, CardQueryTagResult>();
    for (const directTag of context.tags) {
        const pending = [...(context.ancestorTagIdsByChild.get(directTag.tagId) ?? [])];
        const visited = new Set<string>();
        while (pending.length > 0) {
            const tagId = pending.pop()!;
            if (visited.has(tagId)) continue;
            visited.add(tagId);
            pending.push(...(context.ancestorTagIdsByChild.get(tagId) ?? []));
            if (directTagIds.has(tagId)) continue;
            const definition = context.tagDefinitionsById.get(tagId);
            if (!definition) continue;
            const existing = inheritedByTagId.get(tagId);
            if (!existing || compareWeight(directTag.weight, existing.weight) < 0) inheritedByTagId.set(tagId, {
                tagId: definition.tagId,
                slug: definition.slug,
                label: definition.label,
                weight: directTag.weight,
                annotation: null,
            });
        }
    }
    return sortTags([...inheritedByTagId.values()]);
}

function sortTags(tags: readonly CardQueryTagResult[]): readonly CardQueryTagResult[] {
    return [...tags].sort((left, right) => compareWeight(left.weight, right.weight) || left.label.localeCompare(right.label) || left.slug.localeCompare(right.slug) || left.tagId.localeCompare(right.tagId));
}

function compareWeight(left: CardIdentityTaggingWeight, right: CardIdentityTaggingWeight): number {
    return weightRank(left) - weightRank(right);
}

function weightRank(weight: CardIdentityTaggingWeight): number {
    if (weight === "very_strong") return 0;
    if (weight === "strong") return 1;
    if (weight === "median") return 2;
    return 3;
}

function toCollectionResult(row: CollectionRow): CardQueryCollectionCardResult {
    return {
        collectionCardId: row.collectionCardId,
        quantity: row.quantity,
        finish: row.finish,
        altered: row.altered,
        misprint: row.misprint,
        condition: row.condition,
        locationId: row.locationId,
        locationName: row.locationName,
        locationType: row.locationType,
        cardPrintingId: row.cardPrintingId,
        printedName: row.printedName,
        setCode: row.setCode,
        collectorNumber: row.collectorNumber,
        language: row.language,
    };
}

function truncateOracleText(value: string | null): string | null {
    if (value === null || value.length <= 500) return value;
    return `${value.slice(0, 497)}...`;
}

function isColorSubset(value: string, allowed: string): boolean {
    return [...value].every((color) => allowed.includes(color));
}

function buildDescendantTagMap(rows: readonly {
    readonly parentTagId: string;
    readonly childTagId: string
}[]): ReadonlyMap<string, ReadonlySet<string>> {
    const childrenByParent = new Map<string, string[]>();
    for (const row of rows) childrenByParent.set(row.parentTagId, [...(childrenByParent.get(row.parentTagId) ?? []), row.childTagId]);
    const result = new Map<string, Set<string>>();
    for (const parent of childrenByParent.keys()) {
        const descendants = new Set<string>();
        const pending = [...(childrenByParent.get(parent) ?? [])];
        while (pending.length > 0) {
            const child = pending.pop()!;
            if (descendants.has(child)) continue;
            descendants.add(child);
            pending.push(...(childrenByParent.get(child) ?? []));
        }
        result.set(parent, descendants);
    }
    return result;
}

function buildAncestorTagMap(rows: readonly {
    readonly parentTagId: string;
    readonly childTagId: string
}[]): ReadonlyMap<string, readonly string[]> {
    const parentsByChild = new Map<string, string[]>();
    for (const row of rows) parentsByChild.set(row.childTagId, [...(parentsByChild.get(row.childTagId) ?? []), row.parentTagId]);
    return parentsByChild;
}
