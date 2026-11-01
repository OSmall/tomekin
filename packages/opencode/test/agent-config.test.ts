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

        expect(discovery).toContain("Return useful compared Deck Opportunities");
        expect(discovery).toContain("no fixed quota or universal top-N cutoff");
        expect(discovery).toContain("Do not produce, render, or save a full decklist");
        expect(discovery).toContain("commander-deck-architecture");
        expect(discovery).toContain("sixty-card-constructed-deck-architecture");
        expect(commanderArchitecture).toContain("selected a Deck Opportunity");
        expect(commanderArchitecture).toContain("Preserve the whole confirmed Collection Access Policy");
        expect(commanderArchitecture).toContain("Obtain final joint Availability under the whole confirmed Collection Access Policy");
        expect(coordinator).toContain("collection-opportunity-discovery");
        expect(agent).toContain("tomekin-deck-building");
        expect(coordinator).toContain("Format is absent or ambiguous");
        expect(coordinator).toMatch(/Do not silently default to\s+Commander/);
        expect(coordinator).toContain("Rule Zero exceptions must be explicit");
        expect(coordinator).toContain("contextualised nominated-card tuning review");
        expect(coordinator).toContain("explicit Addition Pool");
    });

    test("routes fresh 60-card construction through the selected-opportunity methodology", () => {
        const methodology = read(".opencode/skills/sixty-card-constructed-deck-architecture/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");

        expect(methodology).toContain("selected Deck Opportunity or sufficiently specific Format Anchor");
        expect(methodology).toContain("three weakest included nonland cards");
        expect(methodology).toContain("accept** or **revise");
        expect(methodology).toContain("selection, not net card advantage");
        expect(methodology).toContain("19.59");
        expect(methodology).toContain("Do not create a Sideboard by default");
        expect(methodology).toContain("Save authorized structurally sound construction as it progresses");
        expect(coordinator).toContain("sixty-card-constructed-deck-architecture");
        expect(coordinator).toMatch(/selected\s+Deck Opportunity or specific Format Anchor/);
    });

    test("routes Existing 60-card decks through diagnosis before architecture", () => {
        const tuning = read(".opencode/skills/sixty-card-constructed-deck-tuning/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");

        for (const path of ["Focused repair", "Rebuild around identity", "Fresh construction"]) {
            expect(tuning).toContain(path);
        }
        expect(tuning).toContain("Pair every recommended addition with a cut");
        expect(tuning).toMatch(/Existing\s+explicit authorization/);
        expect(tuning).toContain("edit_deck_candidate");
        expect(coordinator).toContain("sixty-card-constructed-deck-tuning");
        expect(coordinator).toContain("Do not route it directly to fresh architecture");
    });

    test("documents deterministic allow-list reuse and staged Card Query retrieval", () => {
        const querySkill = read(".opencode/skills/query-cards/SKILL.md");
        const coordinator = read(".opencode/skills/tomekin-deck-building/SKILL.md");

        const legacyQuery = read("skills/query-cards/legacy-query.md");
        expect(legacyQuery).toContain("Canonical Collection Location Allow-list");
        expect(legacyQuery).toContain("(locationType, locationName)");
        expect(legacyQuery).toContain("invalid workflow usage");
        expect(querySkill).toContain("Staged Retrieval");
        expect(legacyQuery).toContain("Local `legacy_query_cards` has no pagination");
        expect(coordinator).toContain("final Availability recheck");
        expect(coordinator).toContain("procedural");
    });

    test("documents the complete public Card Query legality vocabulary", () => {
        const querySkill = read("skills/query-cards/legacy-query.md");

        for (const format of ["commander", "standard", "pioneer", "modern", "legacy", "vintage", "pauper"]) {
            expect(querySkill).toContain(`legality.${format}`);
        }
        expect(querySkill).toContain("`legality.casual_60` is invalid");
    });

    test("permits Card Set discovery and documents Printing-scope semantics", () => {
        const querySkill = read("skills/query-cards/legacy-query.md");
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
