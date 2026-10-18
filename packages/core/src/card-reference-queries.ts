import {err, ok, type Result} from "neverthrow";
import type {
    CardIdentity,
    CardIdentityFormatLegality,
    CardIdentityPart,
    CardIdentityTag,
    CardIdentityTagging,
    CardSet,
    ScryfallBulkDataImport,
    ScryfallBulkDataType,
} from "./scryfall-sync";
import {requiredScryfallImportContractRevisions} from "./scryfall-sync";
import {DeckFormatSchema} from "./deck-building-brief";

export type CardReferenceRepositoryError = {
  readonly type: "repository_error" | "not_found";
  readonly message: string;
};

export type CardIdentityDetail = {
  readonly identity: CardIdentity;
  readonly parts: readonly CardIdentityPart[];
  readonly legalities: readonly CardIdentityFormatLegality[];
  readonly tags: readonly (CardIdentityTagging & {readonly slug: string; readonly label: string})[];
};

export type SearchCardIdentitiesInput = {
  readonly query?: string | undefined;
  readonly colorIdentity?: string | undefined;
  readonly commanderColorIdentitySubset?: string | undefined;
  readonly typeLine?: string | undefined;
  readonly oracleText?: string | undefined;
  readonly tag?: string | undefined;
  readonly commanderLegalOnly?: boolean | undefined;
  readonly limit?: number | undefined;
};

export type SearchCardIdentityTagsInput = {
  readonly query?: string | undefined;
  readonly limit?: number | undefined;
};

export type SearchCardSetsInput = {
  readonly query?: string | undefined;
  readonly limit?: number | undefined;
};

export type ReferenceDataStatus = {
  readonly required: readonly ScryfallBulkDataType[];
  /** Newest committed import first, independent of timestamps and IDs. */
  readonly imports: readonly ScryfallBulkDataImport[];
  readonly missing: readonly ScryfallBulkDataType[];
    readonly reimportRequired: readonly ScryfallBulkDataType[];
  readonly warnings: readonly string[];
  readonly ready: boolean;
};

export type CardReferenceRepository = {
  readTagCatalogue?: import("./tag-catalogue").TagCatalogueRepository["readTagCatalogue"];
  searchCardIdentities(input: SearchCardIdentitiesInput): Promise<Result<readonly CardIdentity[], CardReferenceRepositoryError>>;
  getCardIdentity(idOrName: string): Promise<Result<CardIdentityDetail, CardReferenceRepositoryError>>;
  searchCardIdentityTags(input: SearchCardIdentityTagsInput): Promise<Result<readonly CardIdentityTag[], CardReferenceRepositoryError>>;
  searchCardSets(input: SearchCardSetsInput): Promise<Result<readonly CardSet[], CardReferenceRepositoryError>>;
  summarizeReferenceSupport(): Promise<Result<ReferenceDataStatus, CardReferenceRepositoryError>>;
  listCardIdentitiesByIds(ids: readonly string[]): Promise<Result<readonly CardIdentityDetail[], CardReferenceRepositoryError>>;
};

/** Select current datasets from repository snapshots ordered newest committed import first.
 * Wall clocks, source dates and IDs do not establish replacement authority; failed attempts never replace it.
 */
export function currentReferenceImports(imports: readonly ScryfallBulkDataImport[]): Map<ScryfallBulkDataType, ScryfallBulkDataImport> {
    const current = new Map<ScryfallBulkDataType, ScryfallBulkDataImport>();
    for (const item of imports) {
        if (item.status === "succeeded" && !current.has(item.bulkDataType)) current.set(item.bulkDataType, item);
    }
    return current;
}

export function summarizeReferenceImports(imports: readonly ScryfallBulkDataImport[], now = new Date()): ReferenceDataStatus {
  const required = ["oracle_cards", "all_cards", "oracle_tags"] as const;
    const latestSuccessful = currentReferenceImports(imports);
    const missing = required.filter((type) => !latestSuccessful.has(type));
    const reimportRequired = required.filter((type) => {
        const imported = latestSuccessful.get(type);
        return imported !== undefined && imported.importContractRevision !== requiredScryfallImportContractRevisions[type];
    });
  const warnings: string[] = [];
  for (const item of latestSuccessful.values()) {
    if (item.sourceUpdatedAt === null) continue;
    const ageDays = (now.getTime() - item.sourceUpdatedAt.getTime()) / 86_400_000;
    if (ageDays > 14) warnings.push(`${item.bulkDataType} reference data is ${Math.floor(ageDays)} days old; refresh if current external facts matter.`);
  }
    return {
        required,
        imports,
        missing,
        reimportRequired,
        warnings,
        ready: missing.length === 0 && reimportRequired.length === 0
    };
}

export function filterCardIdentities(
  identities: readonly CardIdentity[],
  details: readonly CardIdentityDetail[],
  input: SearchCardIdentitiesInput,
): readonly CardIdentity[] {
  const query = input.query?.toLowerCase();
  const typeLine = input.typeLine?.toLowerCase();
  const oracleText = input.oracleText?.toLowerCase();
  const tag = input.tag?.toLowerCase();
  const tagIds = new Set(
    details.filter((detail) => !tag || detail.tags.some((candidate) => candidate.slug.toLowerCase().includes(tag) || candidate.label.toLowerCase().includes(tag))).map((detail) => detail.identity.id),
  );
  return identities
    .filter((card) => !query || card.name.toLowerCase().includes(query))
    .filter((card) => !input.colorIdentity || card.colorIdentity === input.colorIdentity)
    .filter((card) => !input.commanderColorIdentitySubset || isColorSubset(card.colorIdentity, input.commanderColorIdentitySubset))
    .filter((card) => !typeLine || card.typeLine.toLowerCase().includes(typeLine))
    .filter((card) => !oracleText || (card.oracleText ?? "").toLowerCase().includes(oracleText))
    .filter((card) => !tag || tagIds.has(card.id))
    .slice(0, input.limit ?? 25);
}

export function getFormatConstraints(format = "commander") {
    const parsed = DeckFormatSchema.safeParse(format);
    if (!parsed.success) {
    return err({type: "not_found", message: `Unsupported format: ${format}.`} as const);
  }
    if (parsed.data !== "commander") {
        return ok({
            format: parsed.data,
            mainboardMinimum: 60,
            mainboardMaximum: null,
            sideboardMaximum: 15,
            ordinaryCopyLimit: 4,
            basicLandsExempt: true,
            copyLimitOverrides: true,
            usesScryfallLegality: parsed.data !== "casual_60",
        });
    }
  return ok({
    format: "commander" as const,
    deckSizeIncludingCommanders: 100,
    singleton: true,
    basicLandsExempt: true,
    supportedCommanderMechanics: ["single legendary creature", "can be your commander", "Partner", "Partner with", "Friends forever", "Choose a Background", "Doctor's companion"],
    powerLanguage: "Commander Brackets and play-experience expectations, not a custom 1-10 scale.",
  });
}

function isColorSubset(value: string, allowed: string): boolean {
  return [...value].every((color) => allowed.includes(color));
}
