import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createTestRootLoggerFromEnv} from "@mtg-agent/core";
import {
  applySqliteMigrations,
  cardIdentity,
  closeDatabase,
  createSqliteDeckCandidateRepository,
  openDatabase
} from "@mtg-agent/sqlite";

const testLog = createTestRootLoggerFromEnv();

describe("SQLite Deck Candidate repository", () => {
  test("saves and reopens candidate cards with Card Identity names", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-candidate-")), "test.sqlite");
    applySqliteMigrations(dbPath, {log: testLog});
    const db = openDatabase(dbPath, {log: testLog});
    try {
      db.insert(cardIdentity).values([
        identity("33333333-3333-4333-8333-333333333333", "Example Commander", "Legendary Creature — Elf"),
        identity("11111111-1111-4111-8111-111111111111", "Sol Ring", "Artifact"),
      ]).run();
      const repository = createSqliteDeckCandidateRepository(db, {now: () => new Date("2026-01-01T00:00:00.000Z")});

      const saved = await repository.saveDeckCandidate({
        label: "Example Deck",
        format: "commander",
        formatAnchor: "Example Commander",
        commanderBracket: "Bracket 2",
        brief: {goal: "Build an example deck", format: "commander", formatAnchor: "Example Commander", playExperience: "Casual", commanderBracket: "Bracket 2", budget: null, missingCardTolerance: "Moderate", comboTolerance: "Avoid", constraints: [], exclusions: [], assumptions: [], ruleZeroExceptions: []},
        collectionImportTimestamp: null,
        markdown: "# Example Deck",
        cards: [
          {cardIdentityId: "33333333-3333-4333-8333-333333333333", quantity: 1, section: "commander", sortOrder: 0, note: null},
          {cardIdentityId: "11111111-1111-4111-8111-111111111111", quantity: 1, section: "deck", sortOrder: 1, note: null},
        ],
      });

      expect(saved.isOk()).toBe(true);
      if (saved.isErr()) throw new Error(saved.error.message);
      expect(saved.value.cards.map((card) => card.cardName)).toEqual(["Example Commander", "Sol Ring"]);

      const reopened = await repository.getDeckCandidate(saved.value.id);
      expect(reopened.isOk()).toBe(true);
      if (reopened.isErr()) throw new Error(reopened.error.message);
      expect(reopened.value.label).toBe("Example Deck");
      expect(reopened.value.cards).toHaveLength(2);

      const listed = await repository.listDeckCandidates();
      expect(listed.isOk()).toBe(true);
      if (listed.isErr()) throw new Error(listed.error.message);
      expect(listed.value[0]?.cardCount).toBe(2);
    } finally {
      closeDatabase(db);
    }
  });
});

function identity(id: string, name: string, typeLine: string) {
  return {
    id,
    name,
    layout: "normal" as const,
    manaCost: null,
    manaValue: 1,
    typeLine,
    oracleText: null,
    colorIdentity: "" as const,
    colors: null,
    colorIndicator: null,
    producedMana: null,
    keywordsJson: [],
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    edhrecRank: null,
      gameChanger: false,
    sourcePageUri: "https://scryfall.com/card/example",
  };
}
