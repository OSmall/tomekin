import {describe, expect, test} from "bun:test";
import {readFileSync, realpathSync} from "node:fs";
import {join} from "node:path";

const root = join(import.meta.dir, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("canonical product skill delivery", () => {
    test("both adapters expose the five task-specific canonical skills", () => {
        for (const skill of ["deck-development", "card-research", "probability-analysis", "commander", "sixty-card-constructed"]) {
            expect(realpathSync(join(root, `.opencode/skills/${skill}/SKILL.md`))).toBe(realpathSync(join(root, `skills/${skill}/SKILL.md`)));
            expect(read(`skills/${skill}/SKILL.md`)).toContain(`name: ${skill}`);
        }
        expect(read(".opencode/agents/tomekin-deck-builder.md")).toContain("deck-development");
    });

    test("workflow distinguishes discovery, research, review and completed selection", () => {
        const workflow = read("skills/deck-development/SKILL.md");
        for (const requirement of ["Deck Opportunities", "action analysis", "pool-only", "actual saved", "Availability", "Resume", "reasoning_review"]) expect(workflow).toContain(requirement);
        expect(read("skills/card-research/SKILL.md")).toContain("next_cursor");
        expect(read("skills/probability-analysis/SKILL.md")).toContain("castability");
    });
});
