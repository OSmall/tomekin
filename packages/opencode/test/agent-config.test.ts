import {describe, expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const workspaceRoot = join(import.meta.dir, "../../..");

describe("Tomekin agent configuration", () => {
    test("routes open Collection exploration through transient Deck Opportunity discovery", () => {
        const discovery = read(".opencode/skills/collection-opportunity-discovery/SKILL.md");
        const commanderArchitecture = read(".opencode/skills/commander-deck-architecture/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");
        const agent = read(".opencode/agents/tomekin-deck-builder.md");
        const productSession = read("product-session/tomekin-deck-builder.md");

        expect(discovery).toContain("Return up to three viable Deck Opportunities");
        expect(discovery).toContain("never pad the shortlist");
        expect(discovery).toContain("Do not produce, render, or save a full decklist");
        expect(discovery).toContain("commander-deck-architecture");
        expect(discovery).toContain("sixty-card-constructed-deck-architecture");
        expect(commanderArchitecture).toContain("selected a Deck Opportunity");
        expect(commanderArchitecture).toContain("Preserve the confirmed `(locationType, locationName)` Collection allow-list unchanged");
        expect(commanderArchitecture).toContain("Recheck final Availability with the same confirmed Collection Location allow-list");
        expect(coordinator).toContain("collection-opportunity-discovery");
        expect(productSession).toContain("collection-opportunity-discovery");
        expect(agent).toContain("product-session/tomekin-deck-builder.md");
    });

    test("routes fresh 60-card construction through the selected-opportunity methodology", () => {
        const methodology = read(".opencode/skills/sixty-card-constructed-deck-architecture/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");
        const productSession = read("product-session/tomekin-deck-builder.md");

        expect(methodology).toContain("selected Deck Opportunity or sufficiently specific Format Anchor");
        expect(methodology).toContain("three weakest included nonland cards");
        expect(methodology).toContain("accept** or **revise");
        expect(methodology).toContain("selection, not net card advantage");
        expect(methodology).toContain("19.59");
        expect(methodology).toContain("Do not create a Sideboard by default");
        expect(methodology).toContain("at most three complete construction/review passes");
        expect(coordinator).toContain("sixty-card-constructed-deck-architecture");
        expect(productSession).toMatch(/selected\s+Deck Opportunity or specific Format Anchor/);
    });

    test("routes Existing 60-card decks through diagnosis before architecture", () => {
        const tuning = read(".opencode/skills/sixty-card-constructed-deck-tuning/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");
        const productSession = read("product-session/tomekin-deck-builder.md");

        for (const path of ["Focused repair", "Rebuild around identity", "Fresh construction"]) {
            expect(tuning).toContain(path);
        }
        expect(tuning).toContain("Pair every recommended addition with a cut");
        expect(tuning).toMatch(/wait\s+for separate confirmation/);
        expect(coordinator).toContain("sixty-card-constructed-deck-tuning");
        expect(coordinator).toContain("Do not route it directly to fresh architecture");
        expect(productSession).toContain("sixty-card-constructed-deck-tuning");
        expect(productSession).toContain("Do not route these requests directly");
    });

    test("documents deterministic allow-list reuse and staged Card Query retrieval", () => {
        const querySkill = read(".opencode/skills/query-cards/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");

        expect(querySkill).toContain("Canonical Collection Location Allow-list");
        expect(querySkill).toContain("(locationType, locationName)");
        expect(querySkill).toContain("invalid workflow usage");
        expect(querySkill).toContain("Staged Retrieval");
        expect(querySkill).toContain("Card Query has no pagination");
        expect(coordinator).toContain("final Availability recheck");
        expect(coordinator).toContain("procedural");
    });

    test("documents the complete public Card Query legality vocabulary", () => {
        const querySkill = read(".opencode/skills/query-cards/SKILL.md");

        for (const format of ["commander", "standard", "pioneer", "modern", "legacy", "vintage", "pauper"]) {
            expect(querySkill).toContain(`legality.${format}`);
        }
        expect(querySkill).toContain("`legality.casual_60` is invalid");
    });

    test("permits Card Set discovery and documents Printing-scope semantics", () => {
        const querySkill = read(".opencode/skills/query-cards/SKILL.md");
        const agent = read(".opencode/agents/tomekin-deck-builder.md");

        expect(agent).toContain('"tomekin_search_card_sets": allow');
        expect(querySkill).toContain("search_card_sets");
        expect(querySkill).toContain("withPrinting");
        expect(querySkill).toContain("withoutPrinting");
        expect(querySkill).toContain("printing.universesBeyond");
    });
});

function read(path: string): string {
    return readFileSync(join(workspaceRoot, path), "utf8");
}
