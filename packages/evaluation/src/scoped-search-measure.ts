import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolResultDetails, createRootLogger, resolveLogConfigFromEnv} from "@tomekin/core";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id} from "../../agent/test/fixtures/lookup";

// Synthetic provider, imported reference and Collection fixtures; no network or user data.
const fixture = await createCollectionFixture();
await fixture.reimportTags();
const directory = mkdtempSync(join(tmpdir(), "tomekin-scoped-measure-"));
const path = join(directory, "log.jsonl");
const log = createRootLogger(resolveLogConfigFromEnv({NODE_ENV: "production", TOMEKIN_LOG_DESTINATION: "file", TOMEKIN_LOG_FILE: path, TOMEKIN_LOG_FORMAT: "json"}));
const data = Array.from({length: 80}, (_, n) => ({object: "card", id: id(1000 + n), oracle_id: n === 30 || n === 65 ? id(1) : id(999), name: "Sol Ring", layout: "normal"}));
const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, search: {provider: {id: "fixture", async dispatch() {return {status: 200, body: {object: "list", data, has_more: false}};}}}});
try {
    for (const tags of [true, false]) for (let run = 0; run < 4; run++) {
        const args = {q: "fixture", select: tags ? {name: true, tags: true} : {name: true}, collection_scope: {}, collection_policy: {kind: "explicit", policy: fixture.policy}, first: 1};
        let after: string | undefined, returned = 0;
        do {
            const result = agentToolResultDetails(await runtime.handlers.searchCards({...args, ...(after ? {after} : {})})) as any;
            if (result.status !== "ok") throw new Error(JSON.stringify(result));
            returned += result.edges.length;
            after = result.next_cursor;
        } while (after);
        if (returned !== 2) throw new Error(`Expected two results, got ${returned}`);
    }
    const rows = readFileSync(path, "utf8").trim().split("\n").map(line => JSON.parse(line)).filter(row => row.operation === "search_cards");
    console.log(JSON.stringify(rows.map(({durationMs, providerStageMs, localMs, projectionMs, rawCount, tagEnrichmentReads, returnedCount, providerPages}: any) => ({durationMs, providerStageMs, localMs, projectionMs, rawCount, tagEnrichmentReads, returnedCount, providerPages})), null, 2));
} finally {
    runtime.close(); fixture.dispose(); rmSync(directory, {recursive: true, force: true});
}
