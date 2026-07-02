import {err, ok} from "neverthrow";
import type {
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
    ColorIdentity,
    FormatLegality,
} from "@mtg-agent/core";
import {colorIdentityValues, filterHasCollectionPredicate} from "@mtg-agent/core";
import type {MtgAgentDatabase} from "./database";

type SqlParam = string | number | boolean | null;

type SqlFragment = {
    readonly text: string;
    readonly params: readonly SqlParam[];
};

type CollectionScope = {
    readonly sql: SqlFragment;
};

type CompiledFilter = {
    readonly match: SqlFragment;
    readonly scope?: CollectionScope | undefined;
};

type CompilerState = {
    nextScopeId: number;
};

type PrimaryRow = {
    readonly id: string;
    readonly name: string;
    readonly manaCost: string | null;
    readonly manaValue: number;
    readonly typeLine: string;
    readonly oracleText: string | null;
    readonly colorIdentity: ColorIdentity;
    readonly gameChanger: number | boolean;
    readonly edhrecRank: number | null;
};

type CollectionRow = CardQueryCollectionCardResult & {
    readonly cardIdentityId: string;
};

type DirectTagRow = CardQueryTagResult & {
    readonly cardIdentityId: string;
};

type InheritedTagRow = {
    readonly childTagId: string;
    readonly tagId: string;
    readonly slug: string;
    readonly label: string;
};

type LegalityRow = {
    readonly cardIdentityId: string;
    readonly format: string;
    readonly legality: FormatLegality;
};

type AtomicCardQueryFilter = Extract<CardQueryFilter, {
    readonly args: readonly [CardQueryPropertyRef, CardQueryValue]
}>;

const sortableColumns = {
    "identity.id": "ci.id",
    "identity.name": "ci.name",
    "identity.manaValue": "ci.mana_value",
    "identity.colorIdentity": "ci.color_identity",
    "identity.edhrecRank": "ci.edhrec_rank",
} as const satisfies Partial<Record<CardQueryProperty, string>>;

const identityColumns = {
    "identity.id": "ci.id",
    "identity.name": "ci.name",
    "identity.typeLine": "ci.type_line",
    "identity.oracleText": "ci.oracle_text",
    "identity.manaValue": "ci.mana_value",
    "identity.colorIdentity": "ci.color_identity",
    "identity.colors": "ci.colors",
    "identity.gameChanger": "ci.game_changer",
    "identity.edhrecRank": "ci.edhrec_rank",
} as const satisfies Partial<Record<CardQueryProperty, string>>;

const sqlOperators = {
    "=": "=",
    "!=": "!=",
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
} as const;

export function createSqliteCardQueryRepository(db: MtgAgentDatabase): CardQueryRepository {
    return {
        async queryCards(input) {
            try {
                const state: CompilerState = {nextScopeId: 1};
                const compiled = input.filter ? compileFilter(input.filter, state) : undefined;
                const hasCollectionPredicate = filterHasCollectionPredicate(input.filter);
                const limit = input.limit ?? 50;
                const primary = compilePrimaryQuery(input, compiled, hasCollectionPredicate, limit, state);
                const rows = db.$client.prepare(primary.text).all(...primary.params) as PrimaryRow[];
                const ids = rows.map((row) => row.id);
                const legalitiesByIdentity = input.include?.legalities ? hydrateLegalities(db, ids, input.include.legalities) : new Map<string, LegalityRow[]>();
                const tagsByIdentity = input.include?.tags ? hydrateTags(db, ids) : new Map<string, {
                    direct: readonly CardQueryTagResult[];
                    inherits: readonly CardQueryTagResult[]
                }>();
                const collectionRowsByIdentity = input.include?.collectionCards ? hydrateCollectionRows(db, ids, hasCollectionPredicate ? compiled?.scope : undefined) : new Map<string, CollectionRow[]>();

                return ok({
                    limit,
                    items: rows.map((row) => toResultItem(
                        row,
                        input,
                        legalitiesByIdentity.get(row.id) ?? [],
                        tagsByIdentity.get(row.id) ?? {direct: [], inherits: []},
                        collectionRowsByIdentity.get(row.id) ?? [],
                    )),
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

function compilePrimaryQuery(input: CardQueryInput, compiled: CompiledFilter | undefined, hasCollectionPredicate: boolean, limit: number, state: CompilerState): SqlFragment {
    const where = compiled?.match ?? fragment("1 = 1");
    const order = compileOrderBy(input, compiled?.scope, hasCollectionPredicate, state);
    return joinFragments([
        fragment(`select ci.id,
                         ci.name,
                         ci.mana_cost      as manaCost,
                         ci.mana_value     as manaValue,
                         ci.type_line      as typeLine,
                         ci.oracle_text    as oracleText,
                         ci.color_identity as colorIdentity,
                         ci.game_changer   as gameChanger,
                         ci.edhrec_rank    as edhrecRank
                  from card_identity ci
                  where `),
        where,
        fragment(`\n${order.text}\nlimit ?`, [...order.params, limit]),
    ]);
}

function compileFilter(filter: CardQueryFilter, state: CompilerState, inputScope?: CollectionScope): CompiledFilter {
    if (filter.op === "and") return compileAnd(filter.args, state, inputScope);
    if (filter.op === "or") return compileOr(filter.args, state, inputScope);
    if (filter.op === "not") {
        const child = compileFilter(filter.args[0], state, inputScope);
        return {match: wrap("not (", child.match, ")")};
    }
    if (filter.op === "withTagging") return compileWithTagging(filter.args[0], state);
    if (filter.op === "withCollectionCard") return compileFilter(filter.args[0], state, inputScope);
    if (!isAtomicFilter(filter)) return {match: fragment("0 = 1")};

    const property = filter.args[0].property;
    if (property.startsWith("collection.")) return compileCollectionFilter(filter, state, inputScope);
    return {match: compileReferenceFilter(filter, state)};
}

function compileAnd(args: readonly CardQueryFilter[], state: CompilerState, inputScope?: CollectionScope): CompiledFilter {
    let scope = inputScope;
    const matches: SqlFragment[] = [];
    const ordered = [...args.filter((candidate) => !isCollectionQuantityFilter(candidate)), ...args.filter(isCollectionQuantityFilter)];
    for (const child of ordered) {
        const compiled = compileFilter(child, state, scope);
        matches.push(compiled.match);
        if (compiled.scope) scope = compiled.scope;
    }
    return {
        match: joinSql(matches, " and ", "1 = 1"),
        scope: scope === inputScope ? undefined : scope,
    };
}

function compileOr(args: readonly CardQueryFilter[], state: CompilerState, inputScope?: CollectionScope): CompiledFilter {
    const children = args.map((child) => compileFilter(child, state, inputScope));
    const scopedChildren = children.filter((child): child is CompiledFilter & {
        readonly scope: CollectionScope
    } => child.scope !== undefined);
    const unscopedMatches = children.filter((child) => child.scope === undefined).map((child) => child.match);
    const match = joinSql(children.map((child) => child.match), " or ", "0 = 1");

    if (scopedChildren.length === 0) return {match, scope: inputScope};

    const scopedMatch = joinSql(scopedChildren.map((child) => child.match), " or ", "0 = 1");
    const scopeParts = scopedChildren.map((child) => guardScope(child.scope, child.match));
    if (inputScope && unscopedMatches.length > 0) {
        scopeParts.push(guardScope(inputScope, joinFragments([
            fragment("("),
            joinSql(unscopedMatches, " or ", "0 = 1"),
            fragment(") and not ("),
            scopedMatch,
            fragment(")"),
        ])));
    }

    return {match, scope: unionScopes(scopeParts)};
}

function compileReferenceFilter(filter: AtomicCardQueryFilter, state: CompilerState): SqlFragment {
    const property = filter.args[0].property;
    const value = filter.args[1];
    if (property === "legality.commander") return compileLegalityFilter(filter.op, value);
    if (property.startsWith("tag.")) return compileIndependentTagFilter(filter, state);
    if (filter.op === "contains") return compileContains(identityColumn(property), value as CardQueryScalar);
    if (filter.op === "in") return compileIn(identityColumn(property), value as readonly CardQueryScalar[], property);
    if (filter.op === "colorIdentitySubsetOf") return compileIn(identityColumn(property), colorIdentitySubsets(value as string), property);
    return compileScalarComparison(identityColumn(property), filter.op, normalizeValue(property, value as CardQueryScalar));
}

function compileLegalityFilter(op: CardQueryFilter["op"], value: CardQueryValue): SqlFragment {
    const predicate = op === "in"
        ? compileIn("cifl.legality", value as readonly CardQueryScalar[], "legality.commander")
        : compileScalarComparison("cifl.legality", op, value as CardQueryScalar);
    return joinFragments([
        fragment("exists (select 1 from card_identity_format_legality cifl where cifl.card_identity_id = ci.id and cifl.format = ? and ", ["commander"]),
        predicate,
        fragment(")"),
    ]);
}

function compileIndependentTagFilter(filter: AtomicCardQueryFilter, state: CompilerState): SqlFragment {
    const tagAlias = `tag_${state.nextScopeId++}`;
    const taggingAlias = `cit_${state.nextScopeId++}`;
    const predicate = compileTagRowPredicate(filter, state, taggingAlias, tagAlias);
    const needsTagJoin = filter.args[0].property === "tag.slug" || filter.args[0].property === "tag.label";
    return joinFragments([
        fragment(`exists (select 1 from card_identity_tagging ${taggingAlias}`),
        needsTagJoin ? fragment(` join card_identity_tag ${tagAlias} on ${tagAlias}.id = ${taggingAlias}.tag_id`) : fragment(""),
        fragment(` where ${taggingAlias}.card_identity_id = ci.id and `),
        predicate,
        fragment(")"),
    ]);
}

function compileWithTagging(filter: CardQueryFilter, state: CompilerState): CompiledFilter {
    const tagAlias = `tag_${state.nextScopeId++}`;
    const taggingAlias = `cit_${state.nextScopeId++}`;
    const predicate = compileTagScopeFilter(filter, state, taggingAlias, tagAlias);
    return {
        match: joinFragments([
            fragment(`exists (select 1 from card_identity_tagging ${taggingAlias} join card_identity_tag ${tagAlias} on ${tagAlias}.id = ${taggingAlias}.tag_id where ${taggingAlias}.card_identity_id = ci.id and `),
            predicate,
            fragment(")"),
        ]),
    };
}

function compileTagScopeFilter(filter: CardQueryFilter, state: CompilerState, taggingAlias: string, tagAlias: string): SqlFragment {
    if (filter.op === "and") return joinSql(filter.args.map((child) => compileTagScopeFilter(child, state, taggingAlias, tagAlias)), " and ", "1 = 1");
    if (filter.op === "or") return joinSql(filter.args.map((child) => compileTagScopeFilter(child, state, taggingAlias, tagAlias)), " or ", "0 = 1");
    if (!isAtomicFilter(filter)) return fragment("0 = 1");
    return compileTagRowPredicate(filter, state, taggingAlias, tagAlias);
}

function compileTagRowPredicate(filter: AtomicCardQueryFilter, state: CompilerState, taggingAlias: string, tagAlias: string): SqlFragment {
    const property = filter.args[0].property;
    const value = filter.args[1];
    if (filter.op === "hasTagInHierarchy") return compileTagHierarchyPredicate(`${taggingAlias}.tag_id`, value as string);
    if (property === "tag.alias") {
        const aliasAlias = `tag_alias_${state.nextScopeId++}`;
        const predicate = filter.op === "in"
            ? compileIn(`${aliasAlias}.alias`, value as readonly CardQueryScalar[], property)
            : compileScalarComparison(`${aliasAlias}.alias`, filter.op, value as CardQueryScalar);
        return joinFragments([
            fragment(`exists (select 1 from card_identity_tag_alias ${aliasAlias} where ${aliasAlias}.tag_id = ${taggingAlias}.tag_id and `),
            predicate,
            fragment(")"),
        ]);
    }
    const column = property === "tag.id"
        ? `${taggingAlias}.tag_id`
        : property === "tag.weight"
            ? `${taggingAlias}.weight`
            : property === "tag.slug"
                ? `${tagAlias}.slug`
                : `${tagAlias}.label`;
    if (filter.op === "in") return compileIn(column, value as readonly CardQueryScalar[], property);
    return compileScalarComparison(column, filter.op, value as CardQueryScalar);
}

function compileTagHierarchyPredicate(tagIdColumn: string, tagId: string): SqlFragment {
    return fragment(`${tagIdColumn} in (
with recursive tag_scope(tag_id) as (
  select ?
  union
  select h.child_tag_id
  from card_identity_tag_hierarchy h
  join tag_scope scope on h.parent_tag_id = scope.tag_id
)
select tag_id from tag_scope
)`, [tagId]);
}

function compileCollectionFilter(filter: AtomicCardQueryFilter, state: CompilerState, inputScope?: CollectionScope): CompiledFilter {
    const property = filter.args[0].property;
    const value = filter.args[1];
    if (property === "collection.quantity") {
        const scope = inputScope ?? allCollectionScope(state);
        const quantity = scopeQuantity(scope, state);
        return {
            match: compileScalarComparison(`(${quantity.text})`, filter.op, value as CardQueryScalar, quantity.params),
            scope,
        };
    }

    const scope = filteredCollectionScope(state, inputScope, (aliases) => {
        const column = collectionColumn(property, aliases);
        if (filter.op === "in") return compileIn(column, value as readonly CardQueryScalar[], property);
        return compileScalarComparison(column, filter.op, normalizeValue(property, value as CardQueryScalar));
    });
    return {
        match: wrap("exists (", scope.sql, ")"),
        scope,
    };
}

function allCollectionScope(state: CompilerState): CollectionScope {
    const id = state.nextScopeId++;
    return {
        sql: fragment(`select cc_scope_${id}.id as collection_card_id
from collection_card cc_scope_${id}
join card_printing cp_scope_${id} on cp_scope_${id}.id = cc_scope_${id}.card_printing_id
where cp_scope_${id}.card_identity_id = ci.id`),
    };
}

function filteredCollectionScope(state: CompilerState, inputScope: CollectionScope | undefined, compilePredicate: (aliases: {
    readonly cc: string;
    readonly cl: string
}) => SqlFragment): CollectionScope {
    const id = state.nextScopeId++;
    const cc = `cc_scope_${id}`;
    const cp = `cp_scope_${id}`;
    const cl = `cl_scope_${id}`;
    const predicate = compilePredicate({cc, cl});
    const parts = [
        fragment(`select ${cc}.id as collection_card_id
from collection_card ${cc}
join card_printing ${cp} on ${cp}.id = ${cc}.card_printing_id
join collection_location ${cl} on ${cl}.id = ${cc}.collection_location_id
where ${cp}.card_identity_id = ci.id and `),
        predicate,
    ];
    if (inputScope) parts.push(fragment(` and ${cc}.id in (`), inputScope.sql, fragment(")"));
    return {sql: joinFragments(parts)};
}

function guardScope(scope: CollectionScope, predicate: SqlFragment): CollectionScope {
    return {
        sql: joinFragments([
            fragment("select scoped.collection_card_id from ("),
            scope.sql,
            fragment(") scoped where "),
            predicate,
        ]),
    };
}

function unionScopes(scopes: readonly CollectionScope[]): CollectionScope | undefined {
    if (scopes.length === 0) return undefined;
    return {sql: joinSqlTerms(scopes.map((scope) => scope.sql), " union ", "select null as collection_card_id where 0 = 1")};
}

function scopeQuantity(scope: CollectionScope, state: CompilerState): SqlFragment {
    const id = state.nextScopeId++;
    return joinFragments([
        fragment(`coalesce((select sum(cc_quantity_${id}.quantity) from collection_card cc_quantity_${id} where cc_quantity_${id}.id in (`),
        scope.sql,
        fragment(")), 0)"),
    ]);
}

function compileOrderBy(input: CardQueryInput, collectionScope: CollectionScope | undefined, hasCollectionPredicate: boolean, state: CompilerState): SqlFragment {
    const sortby = input.sortby ?? [{property: "identity.id" as const, direction: "asc" as const}];
    const fragments: SqlFragment[] = [];
    for (const sort of sortby) {
        const direction = sort.direction === "desc" ? "desc" : "asc";
        if (sort.property === "collection.quantity") {
            const scope = hasCollectionPredicate ? collectionScope : allCollectionScope(state);
            const quantity = scope ? scopeQuantity(scope, state) : fragment("0");
            fragments.push(fragment(`${quantity.text} ${direction}`, quantity.params));
            continue;
        }
        const column = sortableColumns[sort.property];
        fragments.push(fragment(`(${column} is null) asc, ${column} ${direction}`));
    }
    if (!sortby.some((sort) => sort.property === "identity.id")) fragments.push(fragment("ci.id asc"));
    return joinFragments([fragment("order by "), joinSqlTerms(fragments, ", ", "ci.id asc")]);
}

function hydrateLegalities(db: MtgAgentDatabase, ids: readonly string[], formats: readonly string[]): Map<string, LegalityRow[]> {
    if (ids.length === 0) return new Map();
    const query = fragment(
        `select card_identity_id as cardIdentityId, format, legality from card_identity_format_legality where card_identity_id in (${placeholders(ids.length)}) and format in (${placeholders(formats.length)})`,
        [...ids, ...formats],
    );
    const rows = db.$client.prepare(query.text).all(...query.params) as LegalityRow[];
    return groupBy(rows, (row) => row.cardIdentityId);
}

function hydrateTags(db: MtgAgentDatabase, ids: readonly string[]): Map<string, {
    direct: readonly CardQueryTagResult[];
    inherits: readonly CardQueryTagResult[]
}> {
    if (ids.length === 0) return new Map();
    const directQuery = fragment(`select
  cit.card_identity_id as cardIdentityId,
  tag.id as tagId,
  tag.slug,
  tag.label,
  cit.weight,
  cit.annotation
from card_identity_tagging cit
join card_identity_tag tag on tag.id = cit.tag_id
where cit.card_identity_id in (${placeholders(ids.length)})`, [...ids]);
    const directRows = db.$client.prepare(directQuery.text).all(...directQuery.params) as DirectTagRow[];
    const directByIdentity = groupBy(directRows, (row) => row.cardIdentityId);
    const directTagIds = [...new Set(directRows.map((row) => row.tagId))];
    const ancestorsByChild = hydrateAncestorTags(db, directTagIds);
    const result = new Map<string, {
        direct: readonly CardQueryTagResult[];
        inherits: readonly CardQueryTagResult[]
    }>();
    for (const id of ids) {
        const direct = directByIdentity.get(id) ?? [];
        result.set(id, {
            direct: sortTags(direct.map(toTagResult)),
            inherits: inheritedTags(direct, ancestorsByChild),
        });
    }
    return result;
}

function hydrateAncestorTags(db: MtgAgentDatabase, directTagIds: readonly string[]): ReadonlyMap<string, readonly InheritedTagRow[]> {
    if (directTagIds.length === 0) return new Map();
    const query = fragment(`with recursive ancestors(child_tag_id, ancestor_tag_id) as (
  select h.child_tag_id, h.parent_tag_id
  from card_identity_tag_hierarchy h
  where h.child_tag_id in (${placeholders(directTagIds.length)})
  union
  select ancestors.child_tag_id, h.parent_tag_id
  from card_identity_tag_hierarchy h
  join ancestors on h.child_tag_id = ancestors.ancestor_tag_id
)
select ancestors.child_tag_id as childTagId, tag.id as tagId, tag.slug, tag.label
from ancestors
join card_identity_tag tag on tag.id = ancestors.ancestor_tag_id`, [...directTagIds]);
    const rows = db.$client.prepare(query.text).all(...query.params) as InheritedTagRow[];
    return groupBy(rows, (row) => row.childTagId);
}

function hydrateCollectionRows(db: MtgAgentDatabase, ids: readonly string[], scope: CollectionScope | undefined): Map<string, CollectionRow[]> {
    if (ids.length === 0) return new Map();
    const scopedPredicate = scope ? joinFragments([fragment(" and cc.id in ("), scope.sql, fragment(")")]) : fragment("");
    const query = joinFragments([
        fragment(`select
  cc.id as collectionCardId,
  cc.quantity,
  cc.finish,
  cc.altered,
  cc.misprint,
  cc.condition,
  cl.id as locationId,
  cl.name as locationName,
  cl.type as locationType,
  ci.id as cardIdentityId,
  cp.id as cardPrintingId,
  cp.printed_name as printedName,
  cp.set_code as setCode,
  cp.collector_number as collectorNumber,
  cp.language
from card_identity ci
join card_printing cp on cp.card_identity_id = ci.id
join collection_card cc on cc.card_printing_id = cp.id
join collection_location cl on cl.id = cc.collection_location_id
where ci.id in (${placeholders(ids.length)})`, [...ids]),
        scopedPredicate,
        fragment(" order by ci.id asc, cl.name asc, cc.id asc"),
    ]);
    const rows = (db.$client.prepare(query.text).all(...query.params) as (Omit<CollectionRow, "altered" | "misprint"> & {
        altered: number | boolean;
        misprint: number | boolean
    })[])
        .map((row) => ({...row, altered: Boolean(row.altered), misprint: Boolean(row.misprint)}));
    return groupBy(rows, (row) => row.cardIdentityId);
}

function toResultItem(row: PrimaryRow, input: CardQueryInput, legalities: readonly LegalityRow[], tags: {
    readonly direct: readonly CardQueryTagResult[];
    readonly inherits: readonly CardQueryTagResult[]
}, collectionRows: readonly CollectionRow[]): CardQueryResultItem {
    const include = input.include ?? {};
    return {
        id: row.id,
        name: row.name,
        manaCost: row.manaCost,
        manaValue: row.manaValue,
        typeLine: row.typeLine,
        oracleText: truncateOracleText(row.oracleText),
        colorIdentity: row.colorIdentity,
        gameChanger: Boolean(row.gameChanger),
        edhrecRank: row.edhrecRank,
        ...(include.legalities ? {legalities: Object.fromEntries(legalities.filter((legality) => include.legalities?.includes(legality.format as "commander")).map((legality) => [legality.format, legality.legality])) as Partial<Record<"commander", FormatLegality>>} : {}),
        ...(include.tags ? {tags} : {}),
        ...(include.collectionCards ? {collectionCards: collectionRows.map(toCollectionResult)} : {}),
    };
}

function compileContains(column: string, value: CardQueryScalar): SqlFragment {
    return fragment(`lower(coalesce(${column}, '')) like '%' || lower(?) || '%'`, [String(value)]);
}

function compileIn(column: string, values: readonly CardQueryScalar[], property: CardQueryProperty): SqlFragment {
    return fragment(`${column} in (${placeholders(values.length)})`, values.map((value) => normalizeValue(property, value)));
}

function compileScalarComparison(columnOrExpression: string, op: string, value: SqlParam, prefixParams: readonly SqlParam[] = []): SqlFragment {
    const operator = sqlOperators[op as keyof typeof sqlOperators] ?? "=";
    return fragment(`${columnOrExpression} ${operator} ?`, [...prefixParams, value]);
}

function collectionColumn(property: CardQueryProperty, aliases: { readonly cc: string; readonly cl: string }): string {
    if (property === "collection.locationName") return `${aliases.cl}.name`;
    if (property === "collection.locationType") return `${aliases.cl}.type`;
    if (property === "collection.finish") return `${aliases.cc}.finish`;
    if (property === "collection.altered") return `${aliases.cc}.altered`;
    if (property === "collection.misprint") return `${aliases.cc}.misprint`;
    return `${aliases.cc}.quantity`;
}

function identityColumn(property: CardQueryProperty): string {
    const column = identityColumns[property as keyof typeof identityColumns];
    if (!column) throw new Error(`Unsupported identity property: ${property}`);
    return column;
}

function normalizeValue(property: CardQueryProperty, value: CardQueryScalar): SqlParam {
    if ((property === "identity.gameChanger" || property === "collection.altered" || property === "collection.misprint") && typeof value === "boolean") return value ? 1 : 0;
    return value;
}

function colorIdentitySubsets(allowed: string): readonly string[] {
    return colorIdentityValues.filter((value) => [...value].every((color) => allowed.includes(color)));
}

function isCollectionQuantityFilter(filter: CardQueryFilter): boolean {
    return isAtomicFilter(filter) && filter.args[0].property === "collection.quantity";
}

function isAtomicFilter(filter: CardQueryFilter): filter is AtomicCardQueryFilter {
    return filter.op !== "and" && filter.op !== "or" && filter.op !== "not" && filter.op !== "withTagging" && filter.op !== "withCollectionCard";
}

function joinFragments(parts: readonly SqlFragment[]): SqlFragment {
    return {
        text: parts.map((part) => part.text).join(""),
        params: parts.flatMap((part) => part.params),
    };
}

function joinSql(parts: readonly SqlFragment[], separator: string, fallback: string): SqlFragment {
    if (parts.length === 0) return fragment(fallback);
    const joined: SqlFragment[] = [];
    parts.forEach((part, index) => {
        if (index > 0) joined.push(fragment(separator));
        joined.push(fragment("("), part, fragment(")"));
    });
    return joinFragments(joined);
}

function joinSqlTerms(parts: readonly SqlFragment[], separator: string, fallback: string): SqlFragment {
    if (parts.length === 0) return fragment(fallback);
    const joined: SqlFragment[] = [];
    parts.forEach((part, index) => {
        if (index > 0) joined.push(fragment(separator));
        joined.push(part);
    });
    return joinFragments(joined);
}

function wrap(prefix: string, inner: SqlFragment, suffix: string): SqlFragment {
    return joinFragments([fragment(prefix), inner, fragment(suffix)]);
}

function fragment(text: string, params: readonly SqlParam[] = []): SqlFragment {
    return {text, params};
}

function placeholders(count: number): string {
    return Array.from({length: count}, () => "?").join(", ");
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
    return grouped;
}

function toTagResult(row: DirectTagRow): CardQueryTagResult {
    return {tagId: row.tagId, slug: row.slug, label: row.label, weight: row.weight, annotation: row.annotation};
}

function inheritedTags(directTags: readonly DirectTagRow[], ancestorsByChild: ReadonlyMap<string, readonly InheritedTagRow[]>): readonly CardQueryTagResult[] {
    const directTagIds = new Set(directTags.map((tag) => tag.tagId));
    const inheritedByTagId = new Map<string, CardQueryTagResult>();
    for (const directTag of directTags) {
        for (const ancestor of ancestorsByChild.get(directTag.tagId) ?? []) {
            if (directTagIds.has(ancestor.tagId)) continue;
            const existing = inheritedByTagId.get(ancestor.tagId);
            if (!existing || compareWeight(directTag.weight, existing.weight) < 0) inheritedByTagId.set(ancestor.tagId, {
                tagId: ancestor.tagId,
                slug: ancestor.slug,
                label: ancestor.label,
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
