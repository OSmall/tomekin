import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolResultDetails} from "@tomekin/core";
import {createCollectionFixture} from "./fixtures/collection";
import {id, log} from "./fixtures/lookup";

const card = (printing = id(2), oracle = id(1)) => ({object: "card", id: printing, oracle_id: oracle, name: "Sol Ring", layout: "normal", set: "representative"});
const envelope = (r: unknown): any => agentToolResultDetails(r as any);

test("search and lookup return exact same-row policy summaries and selected actual owned Printing evidence", async () => {
    const f = await createCollectionFixture();
    const requests: string[] = [];
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch(url) {requests.push(url); return {status: 200, body: {object: "list", data: [card(id(998))], has_more: false, total_cards: 1}};}}}});
    try {
        const common = {select: {name: true, set: true}, collection_policy: {kind: "explicit", policy: f.policy}, collection_evidence: {mode: "copies", select: {location: true, finish: true, set: true}}};
        const result = envelope(await runtime.handlers.searchCards({q: "  unique:cards f:commander  ", ...common}));
        expect(result).toMatchObject({status: "ok", collection_context: {state: "ready", collection_import_id: f.imported.id, match: "identity"}, edges: [{node: {card: {set: "representative"}, collection_evidence: {summary: {owned_quantity: 6, eligible_quantity: 2, uncertain_quantity: 0, policy_status: "confirmed"}, copies: [{collection_card_id: id(111), printing_id: id(2), quantity: 2, set: "v10", finish: "nonfoil", location: {id: id(100), type: "binder", name: "Shared"}}]}}}]});
        expect(result.edges[0].node.collection_evidence.copies).toHaveLength(1);
        expect(new URL(requests[0]!).searchParams.get("q")).toBe("  unique:cards f:commander  ");
        expect(requests[0]).not.toContain(f.imported.id);
        const lookup = envelope(await runtime.handlers.lookupCards({...common, select: {name: true}, references: [{kind: "oracle_id", value: id(1)}]}));
        expect(lookup.edges[0].node.collection_evidence).toEqual(result.edges[0].node.collection_evidence);
        const ordinary = envelope(await runtime.handlers.lookupCards({references: [{kind: "oracle_id", value: id(1)}], select: {name: true}}));
        expect(ordinary.collection_context).toBeUndefined();
        expect(ordinary.edges[0].node.collection_evidence).toBeUndefined();
    } finally {runtime.close(); f.dispose();}
});
