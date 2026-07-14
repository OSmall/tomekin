import {randomUUIDv7} from "bun";
import {asc, eq, sql} from "drizzle-orm";
import {err, ok, type Result} from "neverthrow";
import {DeckBuildingBriefSchema, DeckCandidateSchema, type DeckCandidate, type DeckCandidateRepository, type DeckCandidateRepositoryError, type DeckCandidateSummary, type NormalizedSaveDeckCandidateInput} from "@tomekin/core";
import type {TomekinDatabase} from "./database";
import {cardIdentity, deckCandidate, deckCandidateCard} from "./schema";

export function createSqliteDeckCandidateRepository(db: TomekinDatabase, clock: {now(): Date}): DeckCandidateRepository {
  return {
    async saveDeckCandidate(input) {
      return wrap(() => {
        const id = input.id ?? randomUUIDv7();
        const now = clock.now();
        const existing = db.select().from(deckCandidate).where(eq(deckCandidate.id, id)).get();
        db.transaction((tx) => {
          if (existing) {
            tx.update(deckCandidate).set({label: input.label, format: input.format, formatAnchor: input.formatAnchor, commanderBracket: input.commanderBracket, briefJson: input.brief, collectionImportTimestamp: input.collectionImportTimestamp, markdown: input.markdown, updatedAt: now}).where(eq(deckCandidate.id, id)).run();
            tx.delete(deckCandidateCard).where(eq(deckCandidateCard.deckCandidateId, id)).run();
          } else {
            tx.insert(deckCandidate).values({id, label: input.label, format: input.format, formatAnchor: input.formatAnchor, commanderBracket: input.commanderBracket, briefJson: input.brief, collectionImportTimestamp: input.collectionImportTimestamp, markdown: input.markdown, createdAt: now, updatedAt: now}).run();
          }
          input.cards.forEach((card, index) => tx.insert(deckCandidateCard).values({id: randomUUIDv7(), deckCandidateId: id, cardIdentityId: card.cardIdentityId, quantity: card.quantity, section: card.section, sortOrder: card.sortOrder ?? index, note: card.note}).run());
        });
        return readCandidate(db, id);
      });
    },
    async getDeckCandidate(id) {
      return wrap(() => readCandidate(db, id));
    },
    async listDeckCandidates() {
      return wrap(() => db.select({id: deckCandidate.id, label: deckCandidate.label, format: deckCandidate.format, formatAnchor: deckCandidate.formatAnchor, commanderBracket: deckCandidate.commanderBracket, collectionImportTimestamp: deckCandidate.collectionImportTimestamp, createdAt: deckCandidate.createdAt, updatedAt: deckCandidate.updatedAt, cardCount: sql<number>`coalesce(sum(${deckCandidateCard.quantity}), 0)`}).from(deckCandidate).leftJoin(deckCandidateCard, eq(deckCandidate.id, deckCandidateCard.deckCandidateId)).groupBy(deckCandidate.id).orderBy(asc(deckCandidate.label)).all().map((row): DeckCandidateSummary => ({...row, cardCount: Number(row.cardCount)})));
    },
  };
}

function readCandidate(db: TomekinDatabase, id: string): DeckCandidate {
  const row = db.select().from(deckCandidate).where(eq(deckCandidate.id, id)).get();
  if (!row) throw {type: "not_found", message: `Deck Candidate not found: ${id}.`} satisfies DeckCandidateRepositoryError;
  const cards = db.select({cardIdentityId: deckCandidateCard.cardIdentityId, quantity: deckCandidateCard.quantity, section: deckCandidateCard.section, sortOrder: deckCandidateCard.sortOrder, note: deckCandidateCard.note, cardName: cardIdentity.name}).from(deckCandidateCard).innerJoin(cardIdentity, eq(deckCandidateCard.cardIdentityId, cardIdentity.id)).where(eq(deckCandidateCard.deckCandidateId, id)).orderBy(asc(deckCandidateCard.sortOrder), asc(cardIdentity.name)).all();
  return DeckCandidateSchema.parse({...row, brief: DeckBuildingBriefSchema.parse(row.briefJson), markdown: row.markdown, cards});
}

function wrap<T>(fn: () => T): Result<T, DeckCandidateRepositoryError> {
  try {
    return ok(fn());
  } catch (error) {
    if (typeof error === "object" && error !== null && "type" in error && "message" in error) return err(error as DeckCandidateRepositoryError);
    return err({type: "repository_error", message: error instanceof Error ? error.message : String(error)});
  }
}
