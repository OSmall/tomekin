import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import type {CollectionFinish, CollectionLocationType} from "./collection-import";
import {
    type CardIdentityTaggingWeight,
    type ColorIdentity,
    colorIdentityValues,
    type FormatLegality,
    formatLegalityValues
} from "./scryfall-sync";

export const cardQueryPropertyValues = [
    "identity.id",
    "identity.name",
    "identity.typeLine",
    "identity.oracleText",
    "identity.manaValue",
    "identity.colorIdentity",
    "identity.colors",
    "identity.gameChanger",
    "identity.edhrecRank",
    "legality.commander",
    "tag.id",
    "tag.slug",
    "tag.label",
    "tag.alias",
    "tag.weight",
    "collection.quantity",
    "collection.locationName",
    "collection.locationType",
    "collection.finish",
    "collection.altered",
    "collection.misprint",
] as const;
export type CardQueryProperty = (typeof cardQueryPropertyValues)[number];

export const cardQuerySortablePropertyValues = [
    "identity.id",
    "identity.name",
    "identity.manaValue",
    "identity.colorIdentity",
    "identity.edhrecRank",
    "collection.quantity",
] as const;
export type CardQuerySortableProperty = (typeof cardQuerySortablePropertyValues)[number];

export type CardQueryPropertyRef = { readonly property: CardQueryProperty };
export type CardQueryScalar = string | number | boolean;
export type CardQueryValue = CardQueryScalar | readonly CardQueryScalar[];
export type CardQueryFilter =
    | { readonly op: "and" | "or"; readonly args: readonly CardQueryFilter[] }
    | { readonly op: "not"; readonly args: readonly [CardQueryFilter] }
    | {
    readonly op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "contains" | "in" | "colorIdentitySubsetOf" | "hasTagInHierarchy";
    readonly args: readonly [CardQueryPropertyRef, CardQueryValue]
};
type AtomicCardQueryFilter = Extract<CardQueryFilter, {
    readonly args: readonly [CardQueryPropertyRef, CardQueryValue]
}>;

export type CardQueryInclude = {
    readonly legalities?: readonly ["commander", ..."commander"[]] | undefined;
    readonly tags?: boolean | undefined;
    readonly collectionCards?: boolean | undefined;
};

export type CardQuerySort = {
    readonly property: CardQuerySortableProperty;
    readonly direction: "asc" | "desc";
};

export type CardQueryInput = {
    readonly filter?: CardQueryFilter | undefined;
    readonly sortby?: readonly CardQuerySort[] | undefined;
    readonly include?: CardQueryInclude | undefined;
    readonly limit?: number | undefined;
};

export type CardQueryCollectionCardResult = {
    readonly collectionCardId: string;
    readonly quantity: number;
    readonly finish: CollectionFinish;
    readonly altered: boolean;
    readonly misprint: boolean;
    readonly condition: string | null;
    readonly locationId: string;
    readonly locationName: string;
    readonly locationType: CollectionLocationType;
    readonly cardPrintingId: string;
    readonly printedName: string | null;
    readonly setCode: string;
    readonly collectorNumber: string;
    readonly language: string;
};

export type CardQueryTagResult = {
    readonly tagId: string;
    readonly slug: string;
    readonly label: string;
    readonly weight: CardIdentityTaggingWeight;
    readonly annotation: string | null;
};

export type CardQueryResultItem = {
    readonly id: string;
    readonly name: string;
    readonly manaCost: string | null;
    readonly manaValue: number;
    readonly typeLine: string;
    readonly oracleText: string | null;
    readonly colorIdentity: ColorIdentity;
    readonly gameChanger: boolean | null;
    readonly edhrecRank: number | null;
    readonly legalities?: Partial<Record<"commander", FormatLegality>> | undefined;
    readonly tags?: {
        readonly direct: readonly CardQueryTagResult[];
        readonly inherits: readonly CardQueryTagResult[]
    } | undefined;
    readonly collectionCards?: readonly CardQueryCollectionCardResult[] | undefined;
};

export type CardQueryResult = {
    readonly limit: number;
    readonly items: readonly CardQueryResultItem[];
};

export type CardQueryValidationIssue = {
    readonly pointer: string;
    readonly code: string;
    readonly message: string;
    readonly allowedValues?: readonly string[] | undefined;
};

export type CardQueryError =
    | {
    readonly type: "validation_error";
    readonly code: "invalid_card_query";
    readonly message: string;
    readonly issues: readonly CardQueryValidationIssue[]
}
    | { readonly type: "repository_error"; readonly message: string };

export type CardQueryRepository = {
    queryCards(input: CardQueryInput): Promise<Result<CardQueryResult, CardQueryError>>;
};

const SortSchema = z.object({
    property: z.enum(cardQuerySortablePropertyValues),
    direction: z.enum(["asc", "desc"]),
}).strict();

const IncludeSchema = z.object({
    legalities: z.array(z.enum(["commander"])).nonempty().optional(),
    tags: z.boolean().optional(),
    collectionCards: z.boolean().optional(),
}).strict().superRefine((value, context) => {
    if (value.legalities && new Set(value.legalities).size !== value.legalities.length) {
        context.addIssue({
            code: "custom",
            path: ["legalities"],
            message: "include.legalities must not contain duplicate formats."
        });
    }
});

const CardQueryEnvelopeSchema = z.object({
    filter: z.unknown().optional(),
    sortby: z.array(SortSchema).nonempty().optional(),
    include: IncludeSchema.optional(),
    limit: z.number().int().positive().max(200).optional(),
}).strict().superRefine((value, context) => {
    if (value.sortby && new Set(value.sortby.map((sort) => sort.property)).size !== value.sortby.length) {
        context.addIssue({code: "custom", path: ["sortby"], message: "sortby must not contain duplicate properties."});
    }
});

const propertyValues = new Set<string>(cardQueryPropertyValues);
const scalarOperators = new Set(["=", "!=", "<", "<=", ">", ">="]);
const operatorValues = new Set(["and", "or", "not", "=", "!=", "<", "<=", ">", ">=", "contains", "in", "colorIdentitySubsetOf", "hasTagInHierarchy"]);
const colorIdentitySet = new Set<string>(colorIdentityValues);
const formatLegalitySet = new Set<string>(formatLegalityValues);

export function parseCardQueryInput(input: unknown): Result<CardQueryInput, CardQueryError> {
    const parsed = CardQueryEnvelopeSchema.safeParse(input ?? {});
    if (!parsed.success) return err(validationError(parsed.error.issues.map((issue) => ({
        pointer: toJsonPointer(issue.path),
        code: issue.code,
        message: issue.message,
    }))));

    const filterIssues = parsed.data.filter === undefined ? [] : validateFilter(parsed.data.filter, "#/filter");
    if (filterIssues.length > 0) return err(validationError(filterIssues));
    return ok(parsed.data as CardQueryInput);
}

export function filterHasCollectionPredicate(filter: CardQueryFilter | undefined): boolean {
    if (!filter) return false;
    if (filter.op === "and" || filter.op === "or") return filter.args.some(filterHasCollectionPredicate);
    if (filter.op === "not") return filterHasCollectionPredicate(filter.args[0]);
    return isAtomicFilter(filter) && filter.args[0].property.startsWith("collection.");
}

function isAtomicFilter(filter: CardQueryFilter): filter is AtomicCardQueryFilter {
    return filter.op !== "and" && filter.op !== "or" && filter.op !== "not";
}

function validateFilter(value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (!isRecord(value)) return [{pointer, code: "invalid_type", message: "filter must be an object."}];
    const issues: CardQueryValidationIssue[] = [];
    for (const key of Object.keys(value)) {
        if (key !== "op" && key !== "args") issues.push({
            pointer: `${pointer}/${escapePointer(key)}`,
            code: "unrecognized_key",
            message: `Unknown filter key: ${key}.`
        });
    }
    if (typeof value.op !== "string" || !operatorValues.has(value.op)) {
        issues.push({
            pointer: `${pointer}/op`,
            code: "invalid_enum_value",
            message: "Unsupported filter operator.",
            allowedValues: [...operatorValues]
        });
        return issues;
    }
    if (!Array.isArray(value.args)) {
        issues.push({pointer: `${pointer}/args`, code: "invalid_type", message: "filter.args must be an array."});
        return issues;
    }
    if (value.op === "and" || value.op === "or") {
        if (value.args.length === 0) issues.push({
            pointer: `${pointer}/args`,
            code: "too_small",
            message: `${value.op} requires at least one argument.`
        });
        return [...issues, ...value.args.flatMap((arg, index) => validateFilter(arg, `${pointer}/args/${index}`))];
    }
    if (value.op === "not") {
        if (value.args.length !== 1) return [...issues, {
            pointer: `${pointer}/args`,
            code: "invalid_length",
            message: "not requires exactly one filter argument."
        }];
        return [...issues, ...validateFilter(value.args[0], `${pointer}/args/0`)];
    }
    if (value.args.length !== 2) issues.push({
        pointer: `${pointer}/args`,
        code: "invalid_length",
        message: `${value.op} requires a property reference and one value.`
    });
    const propertyRef = value.args[0];
    if (!isRecord(propertyRef) || typeof propertyRef.property !== "string" || !propertyValues.has(propertyRef.property)) {
        issues.push({
            pointer: `${pointer}/args/0/property`,
            code: "invalid_queryable",
            message: "Unsupported queryable property.",
            allowedValues: cardQueryPropertyValues
        });
        return issues;
    }
    return [...issues, ...validateOperatorValue(value.op, propertyRef.property as CardQueryProperty, value.args[1], `${pointer}/args/1`)];
}

function validateOperatorValue(op: string, property: CardQueryProperty, value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (op === "contains") {
        if (!["identity.name", "identity.typeLine", "identity.oracleText"].includes(property)) return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: `contains is not supported for ${property}.`
        }];
        return typeof value === "string" ? [] : [{
            pointer,
            code: "invalid_type",
            message: "contains requires a string value."
        }];
    }
    if (op === "in") {
        if (!Array.isArray(value) || value.length === 0) return [{
            pointer,
            code: "invalid_type",
            message: "in requires a non-empty array value."
        }];
        return value.flatMap((item, index) => validateScalarValue("=", property, item, `${pointer}/${index}`));
    }
    if (op === "colorIdentitySubsetOf") {
        if (property !== "identity.colorIdentity") return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: "colorIdentitySubsetOf only supports identity.colorIdentity."
        }];
        return typeof value === "string" && colorIdentitySet.has(value) ? [] : [{
            pointer,
            code: "invalid_enum_value",
            message: "colorIdentitySubsetOf requires a valid Color Identity value.",
            allowedValues: colorIdentityValues
        }];
    }
    if (op === "hasTagInHierarchy") {
        if (property !== "tag.id") return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: "hasTagInHierarchy only supports tag.id."
        }];
        return typeof value === "string" && z.uuid().safeParse(value).success ? [] : [{
            pointer,
            code: "invalid_string",
            message: "hasTagInHierarchy requires a tag UUID."
        }];
    }
    if (scalarOperators.has(op)) return validateScalarValue(op, property, value, pointer);
    return [];
}

function validateScalarValue(op: string, property: CardQueryProperty, value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (property === "identity.manaValue" || property === "identity.edhrecRank") return typeof value === "number" ? [] : [{
        pointer,
        code: "invalid_type",
        message: `${property} requires a number value.`
    }];
    if (property === "identity.gameChanger" || property === "collection.altered" || property === "collection.misprint") return typeof value === "boolean" ? [] : [{
        pointer,
        code: "invalid_type",
        message: `${property} requires a boolean value.`
    }];
    if (property === "identity.colorIdentity" || property === "identity.colors") return typeof value === "string" && colorIdentitySet.has(value) ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: `${property} requires a valid Color Identity value.`,
        allowedValues: colorIdentityValues
    }];
    if (property === "legality.commander") return typeof value === "string" && formatLegalitySet.has(value) ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: "legality.commander requires a valid legality value.",
        allowedValues: formatLegalityValues
    }];
    if (property === "collection.quantity") {
        if (op === "!=" || value === 0 || (typeof value === "number" && value < 0)) return [{
            pointer,
            code: "invalid_collection_quantity",
            message: "collection.quantity supports positive quantity comparisons only."
        }];
        return typeof value === "number" && Number.isInteger(value) ? [] : [{
            pointer,
            code: "invalid_type",
            message: "collection.quantity requires a positive integer value."
        }];
    }
    if (property === "collection.locationType") return value === "binder" || value === "deck" ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: "collection.locationType must be binder or deck.",
        allowedValues: ["binder", "deck"]
    }];
    if (property === "collection.finish") return value === "nonfoil" || value === "foil" || value === "etched" ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: "collection.finish must be nonfoil, foil, or etched.",
        allowedValues: ["nonfoil", "foil", "etched"]
    }];
    return typeof value === "string" ? [] : [{
        pointer,
        code: "invalid_type",
        message: `${property} requires a string value.`
    }];
}

function validationError(issues: readonly CardQueryValidationIssue[]): CardQueryError {
    return {type: "validation_error", code: "invalid_card_query", message: "Card Query input is invalid.", issues};
}

function toJsonPointer(path: readonly (string | number | symbol)[]): string {
    return `#${path.map((part) => `/${escapePointer(String(part))}`).join("")}`;
}

function escapePointer(value: string): string {
    return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
