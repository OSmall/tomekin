import {eq} from "drizzle-orm";
import {CardIdentitySchema, type CardIdentity, type CardIdentityDetail} from "@tomekin/core";
import type {TomekinDatabase} from "./database";
import {cardIdentity, cardIdentityPart, cardIdentityFormatLegality, cardIdentityTag, cardIdentityTagging} from "./schema";

export function readCardIdentityDetail(db: Pick<TomekinDatabase,"select">, id: string): CardIdentityDetail {
  const identity = db.select().from(cardIdentity).where(eq(cardIdentity.id, id)).get();
  if (!identity) throw {type: "not_found", message: `Card Identity not found: ${id}.`};
  const tags = db.select({tagId: cardIdentityTagging.tagId, cardIdentityId: cardIdentityTagging.cardIdentityId, weight: cardIdentityTagging.weight, annotation: cardIdentityTagging.annotation, slug: cardIdentityTag.slug, label: cardIdentityTag.label}).from(cardIdentityTagging).innerJoin(cardIdentityTag, eq(cardIdentityTagging.tagId, cardIdentityTag.id)).where(eq(cardIdentityTagging.cardIdentityId, id)).all();
  return {
    identity: mapCardIdentity(identity),
    parts: db.select().from(cardIdentityPart).where(eq(cardIdentityPart.cardIdentityId, id)).all(),
    legalities: db.select().from(cardIdentityFormatLegality).where(eq(cardIdentityFormatLegality.cardIdentityId, id)).all(),
    tags,
  };
}

export function mapCardIdentity(row: typeof cardIdentity.$inferSelect): CardIdentity {
    const copyLimitOverride = row.copyLimitOverrideKind === "maximum"
        ? {kind: "maximum" as const, maximum: row.copyLimitOverrideMaximum}
        : {kind: row.copyLimitOverrideKind};
    return CardIdentitySchema.parse({...row, copyLimitOverride, keywords: row.keywordsJson as string[]});
}

