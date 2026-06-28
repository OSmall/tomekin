import {describe, expect, test} from "bun:test";
import {
  type CommanderDeckCard,
  renderDeckCandidateMarkdown,
  renderPortableDecklist,
  validateCommanderDeck
} from "@mtg-agent/core";

describe("Deck Candidate rendering", () => {
  test("renders strict Commander portable decklist", () => {
    expect(renderPortableDecklist([
      {cardIdentityId: "11111111-1111-4111-8111-111111111111", cardName: "Sol Ring", quantity: 1, section: "deck", sortOrder: 1, note: null},
      {cardIdentityId: "22222222-2222-4222-8222-222222222222", cardName: "Arcane Signet", quantity: 1, section: "deck", sortOrder: 2, note: null},
      {cardIdentityId: "33333333-3333-4333-8333-333333333333", cardName: "Example Commander", quantity: 1, section: "commander", sortOrder: 0, note: null},
    ])).toBe(`Commander
1 Example Commander

Deck
1 Sol Ring
1 Arcane Signet`);
  });

  test("includes required stable Markdown sections", () => {
    const markdown = renderDeckCandidateMarkdown({
      label: "Example Deck",
      cards: [{cardIdentityId: "33333333-3333-4333-8333-333333333333", cardName: "Example Commander", quantity: 1, section: "commander", sortOrder: 0, note: null}],
    });

    expect(markdown).toContain("## Game Plan");
    expect(markdown).toContain("## Portable Decklist");
    expect(markdown).toContain("## Collection Status");
      expect(markdown).toContain("Collection availability was not recorded for this Deck Candidate.");
  });
});

describe("Commander legality", () => {
  test("detects ordinary legal commander shell", () => {
    const rows: CommanderDeckCard[] = [
      {card: card("33333333-3333-4333-8333-333333333333", "Example Commander", "Legendary Creature — Elf", "G"), quantity: 1, section: "commander", legalities: [legality("33333333-3333-4333-8333-333333333333")], parts: []},
      {card: card("44444444-4444-4444-8444-444444444444", "Forest", "Basic Land — Forest", ""), quantity: 98, section: "deck", legalities: [legality("44444444-4444-4444-8444-444444444444")], parts: []},
      {card: card("55555555-5555-4555-8555-555555555555", "Rampant Growth", "Sorcery", "G"), quantity: 1, section: "deck", legalities: [legality("55555555-5555-4555-8555-555555555555")], parts: []},
    ];

    expect(validateCommanderDeck(rows).status).toBe("legal");
  });

  test("reports color identity and singleton violations", () => {
    const rows: CommanderDeckCard[] = [
      {card: card("33333333-3333-4333-8333-333333333333", "Example Commander", "Legendary Creature — Elf", "G"), quantity: 1, section: "commander", legalities: [legality("33333333-3333-4333-8333-333333333333")], parts: []},
      {card: card("55555555-5555-4555-8555-555555555555", "Counterspell", "Instant", "U"), quantity: 2, section: "deck", legalities: [legality("55555555-5555-4555-8555-555555555555")], parts: []},
    ];

    const result = validateCommanderDeck(rows);

    expect(result.status).toBe("illegal");
    expect(result.reasons).toContain("Counterspell has color identity U, outside commander identity G.");
    expect(result.reasons).toContain("Counterspell appears 2 times; Commander singleton allows only one non-basic copy.");
  });
});

function card(id: string, name: string, typeLine: string, colorIdentity: "" | "G" | "U") {
  return {
    id,
    name,
    layout: "normal" as const,
    manaCost: null,
    manaValue: 1,
    typeLine,
    oracleText: null,
    colorIdentity,
    colors: null,
    colorIndicator: null,
    producedMana: null,
    keywords: [],
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    edhrecRank: null,
    gameChanger: null,
    sourcePageUri: "https://scryfall.com/card/example",
  };
}

function legality(cardIdentityId: string) {
  return {cardIdentityId, format: "commander", legality: "legal" as const};
}
