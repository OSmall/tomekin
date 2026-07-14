import {and, eq, inArray, like, or, sql} from "drizzle-orm";
import {err, ok, type Result} from "neverthrow";
import type {CardIdentity, CardReferenceRepository, CardReferenceRepositoryError, CardIdentityDetail, SearchCardIdentitiesInput, SearchCardIdentityTagsInput} from "@tomekin/core";
import {CardIdentitySchema, ScryfallBulkDataImportSchema, summarizeReferenceImports} from "@tomekin/core";
import type {TomekinDatabase} from "./database";
import {cardIdentity, cardIdentityFormatLegality, cardIdentityPart, cardIdentityTag, cardIdentityTagAlias, cardIdentityTagging, scryfallBulkDataImport} from "./schema";

export function createSqliteCardReferenceRepository(db: TomekinDatabase): CardReferenceRepository {
  return {
    async searchCardIdentities(input) {
      return wrap(() => {
        const filters = buildCardFilters(input);
        let rows = filters.length > 0
          ? db.select().from(cardIdentity).where(and(...filters)).limit(input.limit ?? 25).all()
          : db.select().from(cardIdentity).limit(input.limit ?? 25).all();
        if (input.commanderLegalOnly) {
          const legalIds = new Set(db.select({id: cardIdentityFormatLegality.cardIdentityId}).from(cardIdentityFormatLegality).where(and(eq(cardIdentityFormatLegality.format, "commander"), eq(cardIdentityFormatLegality.legality, "legal"))).all().map((row) => row.id));
          rows = rows.filter((row) => legalIds.has(row.id));
        }
        if (input.tag) {
          const ids = new Set(db.select({id: cardIdentityTagging.cardIdentityId}).from(cardIdentityTagging).innerJoin(cardIdentityTag, eq(cardIdentityTagging.tagId, cardIdentityTag.id)).where(or(like(cardIdentityTag.slug, `%${input.tag}%`), like(cardIdentityTag.label, `%${input.tag}%`))).all().map((row) => row.id));
          rows = rows.filter((row) => ids.has(row.id));
        }
        return rows.map(mapCardIdentity);
      });
    },
    async getCardIdentity(idOrName) {
      return wrap(() => {
        const identity = db.select().from(cardIdentity).where(or(eq(cardIdentity.id, idOrName), eq(cardIdentity.name, idOrName))).get();
        if (!identity) throw notFound(`Card Identity not found: ${idOrName}.`);
        return getDetail(db, identity.id);
      });
    },
    async searchCardIdentityTags(input) {
      return wrap(() => {
        const query = input.query;
        if (!query) return db.select().from(cardIdentityTag).limit(input.limit ?? 25).all();
        const direct = db.select().from(cardIdentityTag).where(or(like(cardIdentityTag.slug, `%${query}%`), like(cardIdentityTag.label, `%${query}%`))).limit(input.limit ?? 25).all();
        const aliasIds = db.select({tagId: cardIdentityTagAlias.tagId}).from(cardIdentityTagAlias).where(like(cardIdentityTagAlias.alias, `%${query}%`)).all().map((row) => row.tagId);
        const aliasRows = aliasIds.length > 0 ? db.select().from(cardIdentityTag).where(inArray(cardIdentityTag.id, aliasIds)).all() : [];
        return [...direct, ...aliasRows].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index).slice(0, input.limit ?? 25);
      });
    },
    async summarizeReferenceSupport() {
      return wrap(() => summarizeReferenceImports(db.select().from(scryfallBulkDataImport).all().map((row) => ScryfallBulkDataImportSchema.parse({id: row.id, bulkDataType: row.bulkDataType, status: row.status, startedAt: row.startedAt, completedAt: row.completedAt, sourceUpdatedAt: row.sourceUpdatedAt, sourceUri: row.sourceUri, importedRecordCount: row.importedRecordCount, warnings: row.warningsJson as string[], blockingErrors: row.blockingErrorsJson as string[]}))));
    },
    async listCardIdentitiesByIds(ids) {
      return wrap(() => ids.map((id) => getDetail(db, id)));
    },
  };
}

function buildCardFilters(input: SearchCardIdentitiesInput) {
  const filters = [];
  if (input.query) filters.push(like(cardIdentity.name, `%${input.query}%`));
  if (input.colorIdentity !== undefined) filters.push(eq(cardIdentity.colorIdentity, input.colorIdentity as never));
  if (input.commanderColorIdentitySubset !== undefined) filters.push(sql`NOT EXISTS (SELECT 1 FROM json_each('["W","U","B","R","G"]') WHERE instr(${cardIdentity.colorIdentity}, value) > 0 AND instr(${input.commanderColorIdentitySubset}, value) = 0)`);
  if (input.typeLine) filters.push(like(cardIdentity.typeLine, `%${input.typeLine}%`));
  if (input.oracleText) filters.push(like(cardIdentity.oracleText, `%${input.oracleText}%`));
  return filters;
}

function getDetail(db: TomekinDatabase, id: string): CardIdentityDetail {
  const identity = db.select().from(cardIdentity).where(eq(cardIdentity.id, id)).get();
  if (!identity) throw notFound(`Card Identity not found: ${id}.`);
  const tags = db.select({tagId: cardIdentityTagging.tagId, cardIdentityId: cardIdentityTagging.cardIdentityId, weight: cardIdentityTagging.weight, annotation: cardIdentityTagging.annotation, slug: cardIdentityTag.slug, label: cardIdentityTag.label}).from(cardIdentityTagging).innerJoin(cardIdentityTag, eq(cardIdentityTagging.tagId, cardIdentityTag.id)).where(eq(cardIdentityTagging.cardIdentityId, id)).all();
  return {
    identity: mapCardIdentity(identity),
    parts: db.select().from(cardIdentityPart).where(eq(cardIdentityPart.cardIdentityId, id)).all(),
    legalities: db.select().from(cardIdentityFormatLegality).where(eq(cardIdentityFormatLegality.cardIdentityId, id)).all(),
    tags,
  };
}

function mapCardIdentity(row: typeof cardIdentity.$inferSelect): CardIdentity {
  return CardIdentitySchema.parse({...row, keywords: row.keywordsJson as string[]});
}

function wrap<T>(fn: () => T): Result<T, CardReferenceRepositoryError> {
  try {
    return ok(fn());
  } catch (error) {
    if (isRepositoryError(error)) return err(error);
    return err({type: "repository_error", message: error instanceof Error ? error.message : String(error)});
  }
}

function notFound(message: string): CardReferenceRepositoryError {
  return {type: "not_found", message};
}

function isRepositoryError(error: unknown): error is CardReferenceRepositoryError {
  return typeof error === "object" && error !== null && "type" in error && "message" in error;
}
