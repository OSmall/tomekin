import {err, ok, type Result} from "neverthrow";
import type {
  CardIdentity,
  CardIdentityFormatLegality,
  CardIdentityPart,
  CardIdentityTag,
  CardIdentityTagAlias,
  CardIdentityTagging,
  ScryfallBulkDataImport,
  ScryfallBulkDataType,
} from "./scryfall-sync";

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

export type ReferenceDataStatus = {
  readonly required: readonly ScryfallBulkDataType[];
  readonly imports: readonly ScryfallBulkDataImport[];
  readonly missing: readonly ScryfallBulkDataType[];
  readonly warnings: readonly string[];
  readonly ready: boolean;
};

export type CardReferenceRepository = {
  searchCardIdentities(input: SearchCardIdentitiesInput): Promise<Result<readonly CardIdentity[], CardReferenceRepositoryError>>;
  getCardIdentity(idOrName: string): Promise<Result<CardIdentityDetail, CardReferenceRepositoryError>>;
  searchCardIdentityTags(input: SearchCardIdentityTagsInput): Promise<Result<readonly CardIdentityTag[], CardReferenceRepositoryError>>;
  summarizeReferenceSupport(): Promise<Result<ReferenceDataStatus, CardReferenceRepositoryError>>;
  listCardIdentitiesByIds(ids: readonly string[]): Promise<Result<readonly CardIdentityDetail[], CardReferenceRepositoryError>>;
};

export function summarizeReferenceImports(imports: readonly ScryfallBulkDataImport[], now = new Date()): ReferenceDataStatus {
  const required = ["oracle_cards", "all_cards", "oracle_tags"] as const;
  const successful = new Set(imports.filter((item) => item.status === "succeeded").map((item) => item.bulkDataType));
  const missing = required.filter((type) => !successful.has(type));
  const warnings: string[] = [];
  for (const item of imports.filter((candidate) => candidate.status === "succeeded" && candidate.sourceUpdatedAt !== null)) {
    const ageDays = (now.getTime() - item.sourceUpdatedAt!.getTime()) / 86_400_000;
    if (ageDays > 14) warnings.push(`${item.bulkDataType} reference data is ${Math.floor(ageDays)} days old; refresh if current external facts matter.`);
  }
  return {required, imports, missing, warnings, ready: missing.length === 0};
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
  if (format !== "commander") {
    return err({type: "not_found", message: `Unsupported format: ${format}.`} as const);
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
