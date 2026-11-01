import {describe, expect, test} from "bun:test";
import {ok, type Result} from "neverthrow";
import {createCollectionImportServices, createAgentToolHandlers, type ScryfallBulkDataSyncPorts} from "@tomekin/core";
import {openDatabase, closeDatabase, createSqliteCollectionRepository, createSqliteDeckCandidateRepository,
  applySqliteMigrations, createSqliteScryfallRepository, createSqliteCardReferenceRepository, createSqliteCardQueryRepository} from "@tomekin/sqlite";
import {clock, testLog, createDatabase, runCommand, fakeSyncPorts, readRepositorySnapshot,
  rawOracleCard, rawAllCard, rawOracleTag, jsonlGzipStream} from "./fixtures/scryfall-sync";

const oldIdentity = rawOracleCard().oracle_id, oldPrinting = rawAllCard().id;
const targetIdentity = "33333333-3333-4333-8333-333333333333", targetPrinting = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const intermediate = "55555555-5555-4555-8555-555555555555";
const merge = (old = oldPrinting, target: string | null = targetPrinting, id = "44444444-4444-4444-8444-444444444444") => ({
  object: "migration", id, performed_at: "2025-01-01", old_scryfall_id: old,
  migration_strategy: target === null ? "delete" : "merge", ...(target === null ? {} : {new_scryfall_id: target}),
});
type Sources = {oracle_cards: readonly unknown[]; all_cards: readonly unknown[]; oracle_tags: readonly unknown[]};
function nextSources(identity = targetIdentity): Sources {
  return {oracle_cards: [{...rawOracleCard(), oracle_id: identity}],
    all_cards: [{...rawAllCard(), id: targetPrinting, oracle_id: identity}],
    oracle_tags: [{...rawOracleTag(), taggings: [{oracle_id: identity, weight: "strong", annotation: "current"}]}]};
}
function ports(sources: Sources = nextSources(), pages: readonly (readonly unknown[])[] = [[merge()]], onPage?: () => void): ScryfallBulkDataSyncPorts & {calls: string[]} {
  const calls: string[] = [];
  return {...fakeSyncPorts(), calls,
    async downloadBulkData(metadata) {
      return ok({bulkDataType: metadata.bulkDataType, sourceUri: metadata.downloadUri, sourceUpdatedAt: clock.now(),
        stream: () => jsonlGzipStream(sources[metadata.bulkDataType])});
    },
    async listCardMigrations(url) {
      calls.push(url); onPage?.();
      const page = new URL(url).searchParams.get("page"), index = page ? Number(page) - 1 : 0;
      return ok({data: pages[index] ?? [], has_more: index + 1 < pages.length,
        ...(index + 1 < pages.length ? {next_page: `https://api.scryfall.com/migrations?page=${index + 2}`} : {})});
    },
  };
}
async function populated() {
  const {dbPath} = createDatabase();
  expect((await runCommand(["--db", dbPath], fakeSyncPorts())).exitCode).toBe(0);
  return dbPath;
}
function unwrap<T, E>(result: Result<T, E>): T {
  if (result.isErr()) throw new Error(JSON.stringify(result.error));
  return result.value;
}
function connection(path: string) { return openDatabase(path, {log: testLog}); }
async function seedUserData(path: string, identity = oldIdentity, printing = oldPrinting, collision = false) {
  const db = connection(path);
  try {
    const collection = createSqliteCollectionRepository(db, clock);
    unwrap(await collection.replaceCollectionSnapshot({sourcePath: "owned.csv", importedAt: clock.now(), warnings: [],
      summary: {importedRowCount: 1, totalQuantity: 7, locationCount: 1, binderCount: 1, deckCount: 0},
      snapshot: {locations: [{id: "binder", name: "Personal binder", type: "binder"}], cards: [{id: "owned-row", quantity: 7,
        collectionLocationId: "binder", finish: "foil", manaBoxId: "source-row", cardPrintingId: printing,
        misprint: true, altered: false, condition: "near_mint", purchasePriceCurrency: "AUD", purchasePrice: 4.75,
        addedAt: new Date("2024-03-04T12:01:02.123Z"), sourceRowNumber: 8}]}}));
    const candidates = createSqliteDeckCandidateRepository(db, clock);
    const handlers = createAgentToolHandlers({deckCandidates: candidates, cardReference: createSqliteCardReferenceRepository(db),
      cardQuery: createSqliteCardQueryRepository(db), collection});
    const saved = unwrap(await handlers.createDeckCandidate({label: "Preserve authored work", brief: {format: "casual_60", goal: "Develop the deck", powerLevel: null},
      memberships: [{card_identity_id: identity, section: "mainboard", quantity: 3, note: "Selected purposefully"},
        {card_identity_id: identity, section: "sideboard", quantity: 1}],
      options: [{card_identity_id: identity, comparison_note: "Preserve this option"}, ...(collision ? [{card_identity_id: targetIdentity, comparison_note: "Different authored option"}] : [])],
      plan: {schema_version: 1, description: "Preserve the plan", nodes: [{ref: "mana", kind: "role", label: "Mana", description: "Produce mana"}],
        contributions: [{card_identity_id: identity, role_ref: "mana", rationale: "Repeatable resource",
          qualifications: ["Requires tapping"], evidence: [{reference: "Card facts", note: "The printed ability"}]}, ...(collision ? [{card_identity_id: targetIdentity, role_ref: "mana", rationale: "Different role judgment"}] : [])], relationships: []}}));
    return {candidateId: saved.candidate_id, collection: unwrap(await collection.listCollectionCards()), candidate: unwrap(await candidates.getDeckCandidate(saved.candidate_id))};
  } finally { closeDatabase(db); }
}
function logicalSnapshot(path: string) {
  const db = connection(path);
  try {
    const tables = db.$client.query<{name: string}, []>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'scryfall_migration_evidence' ORDER BY name").all();
    return Object.fromEntries(tables.map(({name}) => [name, db.$client.query(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));
  } finally {closeDatabase(db);}
}
function audit(path: string) {
  const db = connection(path);
  try { return {applications: db.$client.query("SELECT * FROM scryfall_migration_application").all(),
    cache: db.$client.query("SELECT * FROM scryfall_migration_evidence").all(), foreignKeys: db.$client.query("PRAGMA foreign_key_check").all()}; }
  finally {closeDatabase(db);}
}

describe("coordinated Scryfall refresh through the command", () => {
  test("bootstrap and ordinary rules, legality and tag updates need no migration history", async () => {
    const path = createDatabase().dbPath;
    const initial = ports({oracle_cards: [rawOracleCard()], all_cards: [rawAllCard()], oracle_tags: [rawOracleTag()]});
    expect((await runCommand(["--db", path], initial)).exitCode).toBe(0);
    const updated = ports({oracle_cards: [{...rawOracleCard(), oracle_text: "Updated source text", legalities: {...rawOracleCard().legalities, modern: "banned"}}],
      all_cards: [rawAllCard()], oracle_tags: [{...rawOracleTag(), label: "Current label"}]});
    expect((await runCommand(["--db", path], updated)).exitCode).toBe(0);
    expect(initial.calls).toEqual([]); expect(updated.calls).toEqual([]);
    const snapshot = await readRepositorySnapshot(path);
    expect(snapshot.identities[0]!.oracleText).toBe("Updated source text");
    expect(snapshot.tags[0]!.label).toBe("Current label");
    const db = connection(path);
    try {expect(unwrap(await createSqliteScryfallRepository(db, clock).listCardIdentityFormatLegalities()).find(row => row.format === "modern")?.legality).toBe("banned");}
    finally {closeDatabase(db);}
  });

  test("lossless merge preserves Collection metadata, selected sections, options and contributions across reopen and repeat", async () => {
    const path = await populated(), before = await seedUserData(path);
    const source = ports();
    expect((await runCommand(["--db", path], source)).exitCode).toBe(0);
    const db = connection(path);
    try {
      expect(unwrap(await createSqliteCollectionRepository(db, clock).listCollectionCards())).toEqual(before.collection.map(row => ({...row, cardPrintingId: targetPrinting})));
      const after = unwrap(await createSqliteDeckCandidateRepository(db, clock).getDeckCandidate(before.candidateId));
      const expected = JSON.parse(JSON.stringify(before.candidate).replaceAll(oldIdentity, targetIdentity));
      expect(JSON.parse(JSON.stringify(after))).toEqual({...expected, updatedAt: after.updatedAt, selectedChangedAt: after.selectedChangedAt, planChangedAt: after.planChangedAt});
      expect(after.updatedAt).not.toEqual(before.candidate.updatedAt);
    } finally {closeDatabase(db);}
    expect(audit(path).foreignKeys).toEqual([]); expect(audit(path).applications).toHaveLength(1);
    const second = ports(); expect((await runCommand(["--db", path], second)).exitCode).toBe(0);
    expect(second.calls).toEqual([]); expect(audit(path).applications).toHaveLength(1);
  });

  test("Printing-only merge preserves a surviving identity and all candidate references", async () => {
    const path = await populated(), before = await seedUserData(path);
    expect((await runCommand(["--db", path], ports(nextSources(oldIdentity)))).exitCode).toBe(0);
    const db = connection(path);
    try {expect(unwrap(await createSqliteDeckCandidateRepository(db, clock).getDeckCandidate(before.candidateId))).toEqual(before.candidate);}
    finally {closeDatabase(db);}
    expect((await readRepositorySnapshot(path)).identities.map(row => row.id)).toEqual([oldIdentity]);
  });

  test("unreferenced official deletes accept omitted or null replacement fields and no human context", async () => {
    for (const deletion of [merge(oldPrinting, null), {...merge(oldPrinting, null), new_scryfall_id: null}]) {
      const path = await populated();
      expect((await runCommand(["--db", path], ports(nextSources(oldIdentity), [[deletion]]))).exitCode).toBe(0);
      expect(audit(path).applications).toHaveLength(1); expect(audit(path).foreignKeys).toEqual([]);
    }
  });

  for (const [name, pages, reason] of [
    ["unexplained disappearance", [[]], "missing_migration_evidence"],
    ["contradictory evidence", [[merge(), merge(oldPrinting, null)]], "migration_conflict"],
    ["cyclic chain", [[merge(oldPrinting, intermediate), merge(intermediate, oldPrinting, "66666666-6666-4666-8666-666666666666")]], "migration_cycle"],
    ["absent replacement", [[merge(oldPrinting, intermediate)]], "missing_migration_evidence"],
    ["malformed merge", [[{...merge(), new_scryfall_id: null}]], "replacement"],
  ] as const) {
    test(`${name} preserves every prior usable table`, async () => {
      const path = await populated(), before = logicalSnapshot(path);
      const result = await runCommand(["--db", path], ports(nextSources(), pages));
      expect(result.exitCode).toBe(1); expect(result.stderr).toContain(reason);
      expect(logicalSnapshot(path)).toEqual(before); expect(audit(path).foreignKeys).toEqual([]);
    });
  }

  test("relevant chain follows another same-date page and stops before unused history", async () => {
    const path = await populated(), source = ports(nextSources(), [[merge(oldPrinting, intermediate)],
      [merge(intermediate, targetPrinting, "66666666-6666-4666-8666-666666666666")], [{invalid: "never examined"}]]);
    expect((await runCommand(["--db", path], source)).exitCode).toBe(0);
    expect(source.calls).toHaveLength(2); expect(audit(path).applications).toHaveLength(2);
  });

  test("referenced deletes protect ownership and candidate work", async () => {
    const path = await populated(); await seedUserData(path); const before = logicalSnapshot(path);
    const result = await runCommand(["--db", path], ports(nextSources(), [[merge(oldPrinting, null)]]));
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("referenced_deletion");
    expect(logicalSnapshot(path)).toEqual(before);
  });

  test("late publication failure rolls back references, user remaps, successful provenance and applied history; retry reuses cache", async () => {
    const path = await populated(); await seedUserData(path);
    const db = connection(path);
    db.$client.exec("CREATE TRIGGER reject_application BEFORE INSERT ON scryfall_migration_application BEGIN SELECT RAISE(ABORT, 'late publication failure'); END");
    closeDatabase(db);
    const before = logicalSnapshot(path), source = ports();
    const result = await runCommand(["--db", path], source);
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("late publication failure");
    expect(logicalSnapshot(path)).toEqual(before); expect(audit(path).cache).toHaveLength(1); expect(audit(path).foreignKeys).toEqual([]);
    const reopened = connection(path);
    expect(unwrap(await createSqliteCollectionRepository(reopened, clock).getPrintingMigrationGuidance!(oldPrinting))).toContain(targetPrinting);
    reopened.$client.exec("DROP TRIGGER reject_application"); closeDatabase(reopened);
    const retry = ports(); expect((await runCommand(["--db", path], retry)).exitCode).toBe(0);
    expect(retry.calls).toEqual([]); expect(audit(path).applications).toHaveLength(1);
  });

  test("a concurrent Collection edit during discovery survives and rejects stale publication", async () => {
    const path = await populated(); await seedUserData(path);
    const source = ports(nextSources(), [[merge()]], () => {
      const other = connection(path); other.$client.exec("UPDATE collection_card SET quantity=9 WHERE id='owned-row'"); closeDatabase(other);
    });
    const result = await runCommand(["--db", path], source);
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("concurrent_state_changed");
    const db = connection(path);
    try {expect(unwrap(await createSqliteCollectionRepository(db, clock).listCollectionCards())[0]!.quantity).toBe(9);}
    finally {closeDatabase(db);}
    expect((await readRepositorySnapshot(path)).identities.map(row => row.id)).toEqual([oldIdentity]);
  });

  test("page, byte and elapsed discovery exhaustion are incomplete reconciliation", async () => {
    for (const kind of ["pages", "bytes", "time"] as const) {
      const path = await populated(), source = ports(nextSources(), Array.from({length: 34}, () => []));
      let now = 0;
      const bounded = {...source, monotonicNow: () => now,
        async listCardMigrations(url: string, budget: {remainingMs: number; remainingBytes: number; remainingRequests: number}) {
          const response = await source.listCardMigrations!(url, budget);
          if (kind === "time") now += 180001;
          return response.map(page => ({...page, ...(kind === "bytes" ? {responseBytes: 17 * 1024 * 1024} : {})}));
        }};
      const before = logicalSnapshot(path), result = await runCommand(["--db", path], bounded);
      expect(result.exitCode).toBe(1); expect(result.stderr).toContain("discovery_budget_exhausted");
      expect(source.calls.length).toBe(kind === "pages" ? 32 : 1); expect(logicalSnapshot(path)).toEqual(before);
    }
  });

  test("equivalent deletes with omitted and null replacements do not conflict", async () => {
    const path = await populated();
    const result = await runCommand(["--db", path], ports(nextSources(oldIdentity), [[merge(oldPrinting, null), {...merge(oldPrinting, null), new_scryfall_id: null}]]));
    expect(result.exitCode).toBe(0);
  });

  test("offline replacement guidance follows corrections across separate refreshes", async () => {
    const path = await populated();
    expect((await runCommand(["--db", path], ports())).exitCode).toBe(0);
    const finalPrinting = "99999999-9999-4999-8999-999999999999";
    const source = nextSources();
    const next = {...source, all_cards: [{...rawAllCard(), id: finalPrinting, oracle_id: targetIdentity}]};
    expect((await runCommand(["--db", path], ports(next, [[merge(targetPrinting, finalPrinting, "66666666-6666-4666-8666-666666666666")]]))).exitCode).toBe(0);
    const db = connection(path);
    try {
      const guidance = unwrap(await createSqliteCollectionRepository(db, clock).getPrintingMigrationGuidance!(oldPrinting));
      expect(guidance).toContain(finalPrinting); expect(guidance).not.toContain(targetPrinting);
    } finally {closeDatabase(db);}
  });

  test("candidate collisions preserve distinct options and authored contributions", async () => {
    const path = createDatabase().dbPath, next = nextSources();
    const initial = ports({oracle_cards: [rawOracleCard(), ...next.oracle_cards], all_cards: [rawAllCard(), ...next.all_cards], oracle_tags: [rawOracleTag()]});
    expect((await runCommand(["--db", path], initial)).exitCode).toBe(0);
    await seedUserData(path, oldIdentity, oldPrinting, true);
    const before = logicalSnapshot(path), result = await runCommand(["--db", path], ports());
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("user_data_conflict"); expect(logicalSnapshot(path)).toEqual(before);
  });

  test("an ambiguous removed identity cannot follow two different replacement identities", async () => {
    const path = createDatabase().dbPath;
    expect((await runCommand(["--db", path], ports({oracle_cards: [rawOracleCard()], all_cards: [rawAllCard(), {...rawAllCard(), id: intermediate}], oracle_tags: [rawOracleTag()]}))).exitCode).toBe(0);
    const anotherIdentity = "77777777-7777-4777-8777-777777777777", anotherPrinting = "88888888-8888-4888-8888-888888888888";
    const next = nextSources(), before = logicalSnapshot(path);
    const result = await runCommand(["--db", path], ports({oracle_cards: [...next.oracle_cards, {...rawOracleCard(), oracle_id: anotherIdentity}],
      all_cards: [...next.all_cards, {...rawAllCard(), id: anotherPrinting, oracle_id: anotherIdentity}], oracle_tags: next.oracle_tags},
      [[merge(), merge(intermediate, anotherPrinting, "66666666-6666-4666-8666-666666666666")]]));
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("ambiguous_identity_replacement"); expect(logicalSnapshot(path)).toEqual(before);
  });

  test("candidate-only deletion blocks when the Collection is empty", async () => {
    const path = await populated(); await seedUserData(path);
    const db = connection(path);
    try {unwrap(await createSqliteCollectionRepository(db, clock).replaceCollectionSnapshot({sourcePath: "empty.csv", importedAt: clock.now(), warnings: [],
      snapshot: {cards: [], locations: []}, summary: {importedRowCount: 0, totalQuantity: 0, locationCount: 0, binderCount: 0, deckCount: 0}}));}
    finally {closeDatabase(db);}
    const before = logicalSnapshot(path), result = await runCommand(["--db", path], ports(nextSources(), [[merge(oldPrinting, null)]]));
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("candidate membership/option references"); expect(logicalSnapshot(path)).toEqual(before);
  });

  test("strict offline Collection imports report locally committed replacement guidance and retain metadata validation", async () => {
    const path = await populated(); await seedUserData(path);
    expect((await runCommand(["--db", path], ports())).exitCode).toBe(0);
    const db = connection(path);
    try {
      const repository = createSqliteCollectionRepository(db, clock), before = unwrap(await repository.listCollectionCards());
      const service = createCollectionImportServices(repository, clock);
      const header = "Binder Name,Binder Type,Name,Set code,Collector number,Foil,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency";
      const row = (id: string, set = "v10") => `Binder,binder,Sol Ring,${set},12,foil,1,source,${id},1,false,false,near_mint,en,AUD`;
      const rejected = await service.importManaBoxCollectionCsv({sourcePath: "old.csv", csvText: `${header}\n${row(oldPrinting)}`});
      expect(rejected.isErr()).toBe(true);
      if (rejected.isErr()) expect(rejected.error.message).toContain(targetPrinting);
      const wrongSet = await service.importManaBoxCollectionCsv({sourcePath: "wrong.csv", csvText: `${header}\n${row(targetPrinting, "wrong")}`});
      expect(wrongSet.isErr()).toBe(true); if (wrongSet.isErr()) expect(wrongSet.error.message).toContain("Set code disagrees");
      expect(unwrap(await repository.listCollectionCards())).toEqual(before);
    } finally {closeDatabase(db);}
  });

  test("generated reconciliation metadata migration upgrades a populated previous schema without changing user data", async () => {
    const path = await populated(); await seedUserData(path);
    const db = connection(path);
    db.$client.exec("DROP TABLE scryfall_migration_application; DROP TABLE scryfall_migration_evidence; DELETE FROM __drizzle_migrations WHERE rowid=(SELECT max(rowid) FROM __drizzle_migrations)");
    closeDatabase(db);
    const before = logicalSnapshot(path);
    applySqliteMigrations(path, {log: testLog});
    const after = logicalSnapshot(path);
    for (const [table, rows] of Object.entries(before)) if (table !== "__drizzle_migrations") expect(after[table]).toEqual(rows);
    expect(audit(path).applications).toEqual([]); expect(audit(path).foreignKeys).toEqual([]);
  });

  test("malformed migration continuation cannot leave the official API", async () => {
    const path = await populated(), before = logicalSnapshot(path);
    const source = {...ports(), async listCardMigrations() {return ok({data: [], has_more: true, next_page: "https://example.com/migrations?page=2"});}};
    const result = await runCommand(["--db", path], source);
    expect(result.exitCode).toBe(1); expect(result.stderr).toContain("invalid_migration_pagination"); expect(logicalSnapshot(path)).toEqual(before);
  });
});
