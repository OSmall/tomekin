import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createProviderDispatchOwner} from "@tomekin/core";
import {openDatabase, closeDatabase, createSqliteCollectionRepository} from "@tomekin/sqlite";
import {createCoreTool, createPiWorkerTransport} from "@tomekin/pi";
import {createFixture, id, log} from "./fixtures";

// These are deliberately synthetic cards, not claims about public card rules or strategic quality.
const cards = [
    [1, "Feast Reader", "As an additional cost, sacrifice a creature. Draw two cards."],
    [2, "Focused Reader", "Draw two cards."],
    [3, "Feast Outlet", "Sacrifice another creature: gain 1 life."],
    [4, "Feast Reward", "Whenever another creature you control dies, each opponent loses 1 life."],
    [5, "Misleading Seed", "When this enters, look at the top card. Put it on the bottom."],
    [25, "Synthetic Meadow", "{T}: Add {G}."],
] as const;

function value(result: any): any {
    if (result.isErr()) throw new Error(JSON.stringify(result.error));
    return result.value;
}
async function allPages(call: (args: any) => Promise<any>, args: any): Promise<any[]> {
    const nodes: any[] = [];
    let after: string | undefined;
    do {
        const page = value(await call({...args, ...(after ? {after} : {})}));
        if (page.status !== "ok") throw new Error(JSON.stringify(page));
        nodes.push(...page.edges.map((edge: any) => edge.node));
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined;
    } while (after);
    return nodes;
}
async function readJson(call: (args: any) => Promise<any>, candidate: string) {
    let state: any;
    for (const node of await allPages(call, {id: candidate, view: "json", first: 7})) {
        if (!node.path.length) {state = node.value; continue;}
        let target = state;
        for (const key of node.path.slice(0, -1)) target = target[key];
        target[node.path.at(-1)] = node.value;
    }
    return state;
}
export async function runWorkflowIntegration() {
    const toolModule = new URL("../../../.opencode/tools/tomekin.ts", import.meta.url).href;
    const {configureAgentToolRuntimeForTests, get_deck_candidate} = await import(toolModule);
    const fixture = createFixture("construction");
    const db = openDatabase(fixture.databasePath, {log});
    let runtime: ReturnType<typeof createLocalAgentToolRuntime> | undefined;
    const transport = createPiWorkerTransport({workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url).href});
    let restore = () => {};
    try {
        for (const [number, name, text] of cards) db.$client.prepare("UPDATE card_identity SET name=?,oracle_text=?,type_line=? WHERE id=?").run(name, text, number === 25 ? "Basic Land" : "Creature", id(number));
        db.$client.prepare("INSERT INTO card_identity_tag (id,slug,label,description,source_page_uri) VALUES (?,?,?,?,?)").run(id(500), "synthetic-feast", "Synthetic feast", "Fixture-only seed including a deliberately unsuitable hit", "https://example.invalid/fixture");
        for (const number of [1, 3, 4, 5]) db.$client.prepare("INSERT INTO card_identity_tagging (tag_id,card_identity_id,weight) VALUES (?,?,?)").run(id(500), id(number), "strong");
        const owned = [[1, 4], [2, 1], [3, 4], [4, 4], [25, 48]];
        const imported = value(await createSqliteCollectionRepository(db, {now: () => new Date("2026-10-18T00:00:00Z")}).replaceCollectionSnapshot({sourcePath: "synthetic-feast.csv", importedAt: new Date("2026-10-18T00:00:00Z"), snapshot: {locations: [{id: id(901), type: "binder", name: "Allowed 1"}], cards: owned.map(([number, quantity], index) => ({id: id(600 + index), quantity: quantity!, collectionLocationId: id(901), finish: "nonfoil" as const, manaBoxId: null, cardPrintingId: id(99 + number!), misprint: false, altered: false, condition: null, purchasePriceCurrency: null, purchasePrice: null, addedAt: null, sourceRowNumber: index + 1}))}, summary: {importedRowCount: 5, totalQuantity: 61, locationCount: 1, binderCount: 1, deckCount: 0}, warnings: []}));
        const policy = {confirmed: true, collection_import_id: imported.id, allowed_locations: [{type: "binder", name: "Allowed 1"}]};
        const requests: string[] = [];
        let clock = 0;
        const provider = createProviderDispatchOwner({now: () => clock, wallNow: () => clock, wait: async ms => {clock += ms;}, async dispatch(raw) {
            const q = new URL(raw).searchParams.get("q")!;
            requests.push(q);
            const selected = q === "otag:synthetic-feast" ? [1, 3, 4, 5] : [1, 2];
            return {status: 200, body: {object: "list", has_more: false, data: cards.filter(([number]) => selected.includes(number)).map(([number, name, oracle_text]) => ({object: "card", id: id(99 + number), oracle_id: id(number), name, layout: "normal", oracle_text}))}};
        }});
        const open = () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, search: {provider}});
        runtime = open();
        const catalogue = value(await runtime.handlers.browseTags({operation: {type: "lookup", slugs: ["synthetic-feast"]}}));
        if (catalogue.edges.length !== 1) throw new Error("Seed unavailable");
        const query = {unique: "cards", select: {name: true, oracle_text: true}, first: 2};
        const seed = await allPages(runtime.handlers.searchCards, {...query, q: "otag:synthetic-feast"});
        const independent = await allPages(runtime.handlers.searchCards, {...query, q: 'o:"draw two cards"'});
        const facts = new Map([...seed, ...independent].map(node => [node.card.oracle_id, node.card]));
        // Only missing local tags and scoped ownership are retrieved; complete provider text is reused.
        const evidence = await allPages(runtime.handlers.lookupCards, {references: [...facts.keys()].map(value => ({kind: "oracle_id", value})), select: {tags: true}, collection_policy: {kind: "explicit", policy}, collection_evidence: {mode: "summary"}, first: 2});
        const rejected = !facts.get(id(5)).oracle_text.includes("Draw two cards");
        const candidatesBefore = value(await runtime.handlers.listDeckCandidates());
        const discovery = {persistedCandidates: Array.isArray(candidatesBefore) ? candidatesBefore.length : candidatesBefore.candidates.length, inspected: facts.size, qualifiedDirections: evidence.some(node => node.status === "found" && node.collection_evidence?.summary.eligible_quantity > 0) && rejected ? 1 : 0, rejectedTagOnlyHit: rejected, independentFunctionalSearch: requests.includes('o:"draw two cards"')};
        const role = (ref: string, label: string, description: string) => ({ref, kind: "role", label, description, coverage_assessment: {summary: "Provisional; selected support is incomplete."}});
        let saved = value(await runtime.handlers.createDeckCandidate({label: "Synthetic Heroic Feast style demonstration", brief: {format: "casual_60", goal: "Repeat creature sacrifices, gain access, convert deaths into life loss", powerLevel: "Illustrative", collectionAccessPolicy: policy}, plan: {schema_version: 1, description: "Authorized incomplete construction; independent outlet, conditional access, death reward. No infinite-combo or quality claim.", nodes: [role("access", "Card access", "Conditional access differs from net advantage"), role("sacrifice", "Sacrifice access", "Supply creature deaths for rewards"), role("reward", "Death reward", "Convert repeated deaths into opponent life loss"), role("mana", "Mana", "Pay costs"), {ref: "win", kind: "win_route", label: "Life loss", description: "Repeat deaths", priority: "primary", rationale: "Reward supported by sacrifice access"}], contributions: [[1,"access"],[1,"sacrifice"],[2,"access"],[3,"sacrifice"],[4,"reward"],[25,"mana"],[26,"mana"]].map(([number, role_ref]) => ({card_identity_id: id(Number(number)), role_ref, rationale: "Inspected synthetic rules support this contextual function", qualifications: number === 1 ? ["Costs a creature; access is conditional and competes for fodder"] : []})), relationships: [{ref: "enable", kind: "enables", source_ref: "sacrifice", target_ref: "reward", rationale: "Deaths supply the reward event"}, {ref: "convert", kind: "supports", source_ref: "reward", target_ref: "win", rationale: "Life loss advances the primary route"}]}, options: [...cards.map(([number]) => number), 26].filter(number => number !== 5).map(number => ({card_identity_id: id(number)}))}));
        const incomplete = await readJson(runtime.handlers.getDeckCandidate, saved.candidate_id);
        runtime.close(); runtime = open();
        const resumed = await readJson(runtime.handlers.getDeckCandidate, saved.candidate_id);
        const memberships = [[1,4],[3,4],[4,4],[25,48]].map(([number, quantity]) => ({action: "set", card_identity_id: id(number!), section: "mainboard", quantity}));
        saved = value(await runtime.handlers.editDeckCandidate({candidate_id: saved.candidate_id, expected_updated_at: saved.updated_at, changes: {memberships}}));
        const construction = {incompleteSelection: incomplete.memberships.length, resumedOptions: resumed.options.length, implicitEvidence: incomplete.validation_evidence.status, selectedCopies: 60};
        // Only Reader -> Focused Reader accepted; the proposed Reward -> Outlet compensation is declined.
        saved = value(await runtime.handlers.editDeckCandidate({candidate_id: saved.candidate_id, expected_updated_at: saved.updated_at, changes: {memberships: [{action: "set", card_identity_id: id(1), section: "mainboard", quantity: 3}, {action: "set", card_identity_id: id(2), section: "mainboard", quantity: 1}], assessments: {mana_curve_adequacy: "Partial acceptance: access remains four copies, sacrifice access falls eight to seven. Unaccepted compensation is not credited; accept the disclosed sacrifice gap pending gameplay."}}}));
        const tuned = await readJson(runtime.handlers.getDeckCandidate, saved.candidate_id);
        const selected = (number: number) => tuned.memberships.filter((m: any) => m.card_identity_id === id(number) && m.section === "mainboard").reduce((sum: number, m: any) => sum + m.quantity, 0);
        const tuning = {selectedCopies: tuned.memberships.reduce((sum: number, m: any) => sum + m.quantity, 0), sacrificeCopies: selected(1) + selected(3), cutOptionRetained: tuned.options.some((o: any) => o.card_identity_id === id(1)), rejectedCompensationApplied: selected(3) !== 4};
        const check = {candidate_id: saved.candidate_id, expected_updated_at: saved.updated_at};
        value(await runtime.handlers.validateFormatLegality(check));
        value(await runtime.handlers.evaluateDeckCandidate(check));
        const proof = value(await runtime.handlers.checkCollectionAvailability({...check, first: 2}));
        const pulls = await allPages(runtime.handlers.getDeckCandidate, {id: saved.candidate_id, view: "collection_pull_list", first: 2});
        const decklist = (await allPages(runtime.handlers.renderDeckCandidate, {candidate_id: saved.candidate_id, output: "portable_decklist", first: 2})).map(node => node.value).join("");
        const trial = value(await runtime.handlers.checkCollectionAvailability({...check, changes: {memberships: [{action: "set", card_identity_id: id(2), section: "sideboard", quantity: 1}]}}));
        const assembly = {...proof.summary, recoveredAllocatedCopies: pulls.filter(node => node.path[0] === "allocations" && node.path.length === 2).reduce((sum, node) => sum + node.value.allocated_quantity, 0), overlapShortage: trial.summary.missing_owned, poolAlternativeExported: decklist.includes("Synthetic 026")};
        restore = configureAgentToolRuntimeForTests({log, createHandlers: open});
        const args = {id: saved.candidate_id, view: "selected", first: 2};
        const application = JSON.stringify(value(await runtime.handlers.getDeckCandidate(args)));
        const text = (output: any) => output.content.map((part: any) => part.text).join("");
        const worker = text(await createCoreTool("get_deck_candidate", {log, transport, databasePath: fixture.databasePath}).execute("workflow-worker", args, new AbortController().signal));
        const fallback = text(await createCoreTool("get_deck_candidate", {log, createRuntime: open}).execute("workflow-fallback", args, new AbortController().signal));
        const opencode = await get_deck_candidate.execute(args as any, {} as any);
        const adapters = {piWorker: worker === application, piFallback: fallback === application, openCode: opencode === application};
        const calc = (populationSize: number, populationSuccesses: number, sampleSize: number) => value(runtime!.handlers.hypergeometricCalculator({operation: "probability", populationSize, populationSuccesses, sampleSize, event: {kind: "at_least", count: 1}})).probability;
        const statistics = {commander: calc(99, 12, 9), sixtyCard: calc(60, 4, 7), minimumCopies: value(runtime.handlers.hypergeometricCalculator({operation: "minimum_successes", populationSize: 60, sampleSize: 7, event: {kind: "at_least", count: 1}, targetProbability: "0.60"})).minimumSuccesses};
        return {kind: "integrated-workflows-v1", discovery, construction, tuning, assembly, adapters, statistics, limits: "Synthetic rules and deterministic decisions; no live model, source coverage, actual gameplay, castability, win rate or human/account acceptance claim."};
    } finally {restore(); runtime?.close(); await transport.close(); closeDatabase(db); fixture.dispose();}
}
if (import.meta.main) console.log(JSON.stringify(await runWorkflowIntegration(), null, 2));
