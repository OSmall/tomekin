import {describe, expect, test} from "bun:test";
import {mkdtempSync, readdirSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sql} from "drizzle-orm";
import {createTestRootLoggerFromEnv} from "@tomekin/core";
import {closeDatabase, createSqliteCardReferenceRepository, openDatabase, prepareLegacyDatabaseForCardSetMigration} from "@tomekin/sqlite";

const testLog = createTestRootLoggerFromEnv();

describe("SQLite migrations", () => {
    test("Card Set migration cleanup removes only regenerable rows", () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "tomekin-card-set-cleanup-")), "test.sqlite");
        const migrationsDirectory = new URL("../drizzle/", import.meta.url);
        let db = openDatabase(dbPath, {log: testLog});
        try {
            for (const filename of readdirSync(migrationsDirectory).filter((name) => /^000[0-5]_.*\.sql$/.test(name)).sort()) {
                runMigrationSql(db, new URL(filename, migrationsDirectory));
            }
            db.run(sql.raw(`INSERT INTO card_identity (id,name,layout,mana_value,type_line,copy_limit_override_kind,color_identity,keywords_json,game_changer,source_page_uri)
                VALUES ('11111111-1111-4111-8111-111111111111','Sol Ring','normal',1,'Artifact','none','','[]',0,'https://scryfall.com/card/v10/12/sol-ring')`));
            db.run(sql.raw(`INSERT INTO card_printing (id,card_identity_id,layout,set_code,collector_number,language,source_page_uri)
                VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','standard','v10','12','en','https://scryfall.com/card/v10/12/sol-ring')`));
            db.run(sql.raw(`INSERT INTO collection_location (id,name,type) VALUES ('loc','Binder','binder')`));
            db.run(sql.raw(`INSERT INTO collection_card (id,quantity,collection_location_id,finish,card_printing_id,misprint,altered,source_row_number)
                VALUES ('owned',1,'loc','nonfoil','22222222-2222-4222-8222-222222222222',0,0,2)`));
            db.run(sql.raw(`INSERT INTO deck_candidate (id,label,format,brief_json,markdown,created_at,updated_at)
                VALUES ('candidate','Saved Candidate','commander','{}','# Saved Candidate',1,1)`));
            db.run(sql.raw(`INSERT INTO deck_candidate_card (id,deck_candidate_id,card_identity_id,quantity,section,sort_order)
                VALUES ('candidate-card','candidate','11111111-1111-4111-8111-111111111111',1,'mainboard',0)`));
        } finally {
            closeDatabase(db);
        }

        const summary = prepareLegacyDatabaseForCardSetMigration(dbPath, {log: testLog});
        expect(summary).toEqual(expect.objectContaining({
            collectionCardsRemoved: 1,
            cardPrintingsRemoved: 1,
            deckCandidatesPreserved: 1,
            deckCandidateCardsPreserved: 1,
        }));

        db = openDatabase(dbPath, {log: testLog});
        try {
            expect(db.$client.query("SELECT COUNT(*) AS count FROM card_printing").get()).toEqual({count: 0});
            expect(db.$client.query("SELECT COUNT(*) AS count FROM collection_card").get()).toEqual({count: 0});
            expect(db.$client.query("SELECT id FROM deck_candidate").get()).toEqual({id: "candidate"});
            expect(db.$client.query("SELECT id FROM deck_candidate_card").get()).toEqual({id: "candidate-card"});
            expect(db.$client.query("SELECT id FROM card_identity").get()).toEqual({id: "11111111-1111-4111-8111-111111111111"});
        } finally {
            closeDatabase(db);
        }

        expect(() => prepareLegacyDatabaseForCardSetMigration(dbPath, {log: testLog})).not.toThrow();
    });

    test("0006 rejects legacy Printings, then preserves Deck Candidates after explicit reference cleanup", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "tomekin-migration-0006-")), "test.sqlite");
        const db = openDatabase(dbPath, {log: testLog});
        try {
            const migrationsDirectory = new URL("../drizzle/", import.meta.url);
            for (const filename of readdirSync(migrationsDirectory).filter((name) => /^000[0-5]_.*\.sql$/.test(name)).sort()) {
                runMigrationSql(db, new URL(filename, migrationsDirectory));
            }
            db.run(sql.raw(`INSERT INTO card_identity (id,name,layout,mana_value,type_line,copy_limit_override_kind,color_identity,keywords_json,game_changer,source_page_uri)
                VALUES ('11111111-1111-4111-8111-111111111111','Sol Ring','normal',1,'Artifact','none','','[]',0,'https://scryfall.com/card/v10/12/sol-ring')`));
            db.run(sql.raw(`INSERT INTO card_printing (id,card_identity_id,layout,set_code,collector_number,language,source_page_uri)
                VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','standard','v10','12','en','https://scryfall.com/card/v10/12/sol-ring')`));
            db.run(sql.raw(`INSERT INTO collection_location (id,name,type) VALUES ('loc','Binder','binder')`));
            db.run(sql.raw(`INSERT INTO collection_card (id,quantity,collection_location_id,finish,card_printing_id,misprint,altered,source_row_number)
                VALUES ('owned',1,'loc','nonfoil','22222222-2222-4222-8222-222222222222',0,0,2)`));
            db.run(sql.raw(`INSERT INTO scryfall_bulk_data_import (id,bulk_data_type,import_contract_revision,status,started_at,completed_at,imported_record_count,warnings_json,blocking_errors_json)
                VALUES ('44444444-4444-4444-8444-444444444444','all_cards',2,'succeeded',1,2,1,'[]','[]')`));
            db.run(sql.raw(`INSERT INTO deck_candidate (id,label,format,format_anchor,brief_json,collection_import_timestamp,markdown,created_at,updated_at)
                VALUES ('candidate','Saved Candidate','commander','Sol Ring','{}',NULL,'# Saved Candidate',1,1)`));
            db.run(sql.raw(`INSERT INTO deck_candidate_card (id,deck_candidate_id,card_identity_id,quantity,section,sort_order,note)
                VALUES ('candidate-card','candidate','11111111-1111-4111-8111-111111111111',1,'mainboard',0,NULL)`));

            const migration = readdirSync(migrationsDirectory).find((name) => /^0006_.*\.sql$/.test(name));
            expect(migration).toBeDefined();
            expect(() => runMigrationSql(db, new URL(migration!, migrationsDirectory))).toThrow();
            expect(db.$client.query("PRAGMA table_info(card_printing)").all().some((column: any) => column.name === "set_code")).toBe(true);
            expect(db.$client.query("SELECT id FROM collection_card").get()).toEqual({id: "owned"});

            db.run(sql`DELETE FROM collection_card`);
            db.run(sql`DELETE FROM collection_location`);
            db.run(sql`DELETE FROM card_printing_finish`);
            db.run(sql`DELETE FROM card_printing_part`);
            db.run(sql`DELETE FROM card_printing`);
            runMigrationSql(db, new URL(migration!, migrationsDirectory));

            expect(db.$client.query("PRAGMA table_info(card_printing)").all().some((column: any) => column.name === "set_code")).toBe(false);
            expect(db.$client.query("PRAGMA table_info(card_printing)").all().find((column: any) => column.name === "set_id")).toEqual(expect.objectContaining({notnull: 1}));
            expect(db.$client.query("SELECT id, label FROM deck_candidate").get()).toEqual({id: "candidate", label: "Saved Candidate"});
            expect(db.$client.query("SELECT id, card_identity_id FROM deck_candidate_card").get()).toEqual({id: "candidate-card", card_identity_id: "11111111-1111-4111-8111-111111111111"});
            const status = await createSqliteCardReferenceRepository(db).summarizeReferenceSupport();
            if (status.isErr()) throw new Error(status.error.message);
            expect(status.value.reimportRequired).toContain("all_cards");
            expect(() => db.run(sql.raw(`INSERT INTO card_printing (id,card_identity_id,layout,set_id,collector_number,language,source_page_uri)
                VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','standard','missing-set','1','en','https://scryfall.com/card/example')`))).toThrow();
        } finally {
            closeDatabase(db);
        }
    });

    test("0005 preserves Commander candidates while cutting over sections and reference derivations", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "tomekin-migration-0005-")), "test.sqlite");
        const db = openDatabase(dbPath, {log: testLog});
        try {
            const migrationsDirectory = new URL("../drizzle/", import.meta.url);
            for (const filename of readdirSync(migrationsDirectory).filter((name) => /^000[0-4]_.*\.sql$/.test(name)).sort()) {
                runMigrationSql(db, new URL(filename, migrationsDirectory));
            }
            const briefJson = '{"goal":"Keep me exact","format":"commander","formatAnchor":"Example Commander","playExperience":"Casual","commanderBracket":"Bracket 2","budget":null,"missingCardTolerance":"Moderate","comboTolerance":"Avoid","constraints":[],"exclusions":[],"assumptions":[],"ruleZeroExceptions":[]}';
            const markdown = "# Existing Candidate\n\n## Portable Decklist\n\nDeck\n1 Sol Ring";
            db.run(sql.raw(`
                INSERT INTO card_identity (id, name, layout, mana_cost, mana_value, type_line, oracle_text,
                                           color_identity, colors, color_indicator, produced_mana, keywords_json, power,
                                           toughness, loyalty, defense, edhrec_rank, game_changer, source_page_uri)
                VALUES ('11111111-1111-4111-8111-111111111111', 'Sol Ring', 'normal', '{1}', 1, 'Artifact',
                        '{T}: Add {C}{C}.', '', NULL, NULL, 'C', '[]', NULL, NULL, NULL, NULL, NULL, 0,
                        'https://scryfall.com/card/v10/12/sol-ring')
            `));
            db.run(sql.raw(`
                INSERT INTO scryfall_bulk_data_import (id, bulk_data_type, status, started_at, completed_at,
                                                       source_updated_at, source_uri, imported_record_count,
                                                       warnings_json, blocking_errors_json)
                VALUES ('22222222-2222-4222-8222-222222222222', 'oracle_cards', 'succeeded', 1, 2, 1,
                        'fixture://oracle', 1, '[]', '[]')
            `));
            db.$client.prepare(`
                INSERT INTO deck_candidate (id, label, format, format_anchor, commander_bracket, brief_json,
                                            collection_import_timestamp, markdown, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run("candidate-1", "Existing Candidate", "commander", "Example Commander", "Bracket 2", briefJson, null, markdown, 10, 20);
            db.run(sql.raw(`
                INSERT INTO deck_candidate_card (id, deck_candidate_id, card_identity_id, quantity, section, sort_order,
                                                 note)
                VALUES ('candidate-card-1', 'candidate-1', '11111111-1111-4111-8111-111111111111', 1, 'deck', 7,
                        'keep note')
            `));

            const migration = readdirSync(migrationsDirectory).find((name) => /^0005_.*\.sql$/.test(name));
            expect(migration).toBeDefined();
            runMigrationSql(db, new URL(migration!, migrationsDirectory));

            const candidate = db.$client.query<{
                brief_json: string;
                markdown: string
            }, []>("SELECT brief_json, markdown FROM deck_candidate WHERE id = 'candidate-1'").get();
            expect(candidate).toEqual({brief_json: briefJson, markdown});
            expect(db.$client.query("PRAGMA table_info(deck_candidate)").all().some((column: any) => column.name === "commander_bracket")).toBe(false);
            expect(db.$client.query("SELECT id, deck_candidate_id, card_identity_id, quantity, section, sort_order, note FROM deck_candidate_card").get()).toEqual({
                id: "candidate-card-1",
                deck_candidate_id: "candidate-1",
                card_identity_id: "11111111-1111-4111-8111-111111111111",
                quantity: 1,
                section: "mainboard",
                sort_order: 7,
                note: "keep note",
            });
            expect(db.$client.query("SELECT copy_limit_override_kind, copy_limit_override_maximum FROM card_identity").get()).toEqual({
                copy_limit_override_kind: "none",
                copy_limit_override_maximum: null,
            });
            expect(db.$client.query("SELECT import_contract_revision FROM scryfall_bulk_data_import WHERE id = '22222222-2222-4222-8222-222222222222'").get()).toEqual({import_contract_revision: 0});
            const referenceStatusResult = await createSqliteCardReferenceRepository(db).summarizeReferenceSupport();
            if (referenceStatusResult.isErr()) throw new Error(referenceStatusResult.error.message);
            const referenceStatus = referenceStatusResult.value;
            expect(referenceStatus.ready).toBe(false);
            expect(referenceStatus.reimportRequired).toEqual(["oracle_cards"]);
            const identityColumns = db.$client.query<{
                name: string;
                notnull: number;
                dflt_value: string | null
            }, []>("PRAGMA table_info(card_identity)").all();
            const overrideKind = identityColumns.find((column) => column.name === "copy_limit_override_kind");
            expect(overrideKind).toEqual(expect.objectContaining({notnull: 1, dflt_value: null}));
            expect(() => db.run(sql.raw("UPDATE card_identity SET copy_limit_override_kind = 'none', copy_limit_override_maximum = 1"))).toThrow();
            expect(() => db.run(sql.raw("UPDATE card_identity SET copy_limit_override_kind = 'maximum', copy_limit_override_maximum = 0"))).toThrow();
            expect(() => db.run(sql.raw("UPDATE deck_candidate_card SET section = 'deck'"))).toThrow();
            expect(db.$client.query("PRAGMA foreign_key_check").all()).toEqual([]);
        } finally {
            closeDatabase(db);
        }
    });

    test("0003 preserves dependent rows while making game_changer required", () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "tomekin-migration-0003-")), "test.sqlite");
        const db = openDatabase(dbPath, {log: testLog});
        try {
            createPre0003CardReferenceSchema(db);
            db.run(sql`
                INSERT INTO card_identity (id, name, layout, mana_cost, mana_value, type_line, oracle_text, color_identity, colors, color_indicator, produced_mana, keywords_json, power, toughness, loyalty, defense, edhrec_rank, game_changer, source_page_uri)
                VALUES ('11111111-1111-4111-8111-111111111111', 'Sol Ring', 'normal', '{1}', 1, 'Artifact', '{T}: Add {C}{C}.', '', NULL, NULL, 'C', '[]', NULL, NULL, NULL, NULL, NULL, NULL, 'https://scryfall.com/card/v10/12/sol-ring')
            `);
            db.run(sql`
                INSERT INTO card_printing (id, card_identity_id, layout, printed_name, set_code, collector_number, language, tcgplayer_id, cardmarket_id, source_page_uri)
                VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'standard', NULL, 'v10', '12', 'en', NULL, NULL, 'https://scryfall.com/card/v10/12/sol-ring')
            `);

            runMigrationSql(db, new URL("../drizzle/0003_third_amazoness.sql", import.meta.url));

            const identity = db.$client.query<{
                game_changer: number
            }, []>("SELECT game_changer FROM card_identity WHERE id = '11111111-1111-4111-8111-111111111111'").get();
            expect(identity).toEqual({game_changer: 0});
            const printing = db.$client.query<{
                count: number
            }, []>("SELECT COUNT(*) AS count FROM card_printing WHERE card_identity_id = '11111111-1111-4111-8111-111111111111'").get();
            expect(printing).toEqual({count: 1});
            const gameChangerColumn = db.$client.query<{
                name: string;
                notnull: number
            }, []>("PRAGMA table_info(card_identity)").all().find((column) => column.name === "game_changer");
            expect(gameChangerColumn?.notnull).toBe(1);
            expect(db.$client.query("PRAGMA foreign_key_check").all()).toEqual([]);
        } finally {
            closeDatabase(db);
        }
    });
});

function runMigrationSql(db: ReturnType<typeof openDatabase>, migrationUrl: URL): void {
    const statements = readFileSync(migrationUrl, "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);

    db.run(sql`PRAGMA foreign_keys = OFF`);
    db.run(sql`BEGIN`);
    try {
        for (const statement of statements) db.run(sql.raw(statement));
        db.run(sql`COMMIT`);
        const foreignKeyViolations = db.$client.query("PRAGMA foreign_key_check").all();
        if (foreignKeyViolations.length > 0) throw new Error(`SQLite migration left foreign key violations: ${JSON.stringify(foreignKeyViolations)}`);
        db.run(sql`PRAGMA foreign_keys = ON`);
    } catch (error) {
        db.run(sql`ROLLBACK`);
        db.run(sql`PRAGMA foreign_keys = ON`);
        const cause = error instanceof Error && "cause" in error ? (error as Error & {
            cause?: unknown
        }).cause : undefined;
        throw cause instanceof Error ? new Error(`${error instanceof Error ? error.message : String(error)}: ${cause.message}`) : error;
    }
}

function createPre0003CardReferenceSchema(db: ReturnType<typeof openDatabase>): void {
    db.run(sql.raw(`
        CREATE TABLE card_identity (
            id text PRIMARY KEY NOT NULL,
            name text NOT NULL,
            layout text DEFAULT 'normal' NOT NULL,
            mana_cost text,
            mana_value real NOT NULL,
            type_line text NOT NULL,
            oracle_text text,
            color_identity text DEFAULT '' NOT NULL,
            colors text,
            color_indicator text,
            produced_mana text,
            keywords_json text DEFAULT '[]' NOT NULL,
            power text,
            toughness text,
            loyalty text,
            defense text,
            edhrec_rank integer,
            game_changer integer,
            source_page_uri text NOT NULL,
            CONSTRAINT card_identity_color_identity_check CHECK(color_identity IN ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG', 'WUBRG'))
        )
    `));
    db.run(sql.raw(`CREATE INDEX idx_card_identity_color_identity ON card_identity (color_identity)`));
    db.run(sql.raw(`
        CREATE TABLE card_printing (
            id text PRIMARY KEY NOT NULL,
            card_identity_id text NOT NULL REFERENCES card_identity(id),
            layout text DEFAULT 'standard' NOT NULL,
            printed_name text,
            set_code text NOT NULL,
            collector_number text NOT NULL,
            language text NOT NULL,
            tcgplayer_id integer,
            cardmarket_id integer,
            source_page_uri text NOT NULL
        )
    `));
    db.run(sql.raw(`CREATE INDEX idx_card_printing_card_identity_id ON card_printing (card_identity_id)`));
}

test("structured candidate migration preserves existing candidate and membership content", () => {
    const dbPath = join(
        mkdtempSync(join(tmpdir(), "tomekin-candidate-migration-")),
        "test.sqlite",
    );
    const db = openDatabase(dbPath, { log: testLog });
    try {
        const directory = new URL("../drizzle/", import.meta.url);
        const files = readdirSync(directory)
            .filter((name) => name.endsWith(".sql"))
            .sort();
        const target = files.find((name) =>
            readFileSync(new URL(name, directory), "utf8").includes(
                "CREATE TABLE `deck_candidate_plan`",
            ),
        )!;
        expect(target).toBeDefined();
        for (const filename of files.filter((name) => name < target))
            runMigrationSql(db, new URL(filename, directory));
        db.$client.run(
            "INSERT INTO card_identity (id,name,layout,mana_value,type_line,copy_limit_override_kind,color_identity,keywords_json,game_changer,source_page_uri) VALUES ('card','Forest','normal',0,'Basic Land','none','G','[]',0,'fixture:forest')",
        );
        db.$client.run(
            "INSERT INTO deck_candidate (id,label,format,brief_json,markdown,created_at,updated_at) VALUES ('candidate','Preserve me','casual_60','{\"goal\":\"Keep exact\"}','# Existing content',12,34)",
        );
        db.$client.run(
            "INSERT INTO deck_candidate_card (id,deck_candidate_id,card_identity_id,quantity,section,sort_order,note) VALUES ('membership','candidate','card',30,'mainboard',7,'Keep note')",
        );
        runMigrationSql(db, new URL(target, directory));
        expect(
            db.$client
                .query(
                    "SELECT id,label,brief_json,markdown,created_at,updated_at FROM deck_candidate",
                )
                .get(),
        ).toEqual({
            id: "candidate",
            label: "Preserve me",
            brief_json: '{"goal":"Keep exact"}',
            markdown: "# Existing content",
            created_at: 12,
            updated_at: 34,
        });
        expect(
            db.$client
                .query(
                    "SELECT id,quantity,section,sort_order,note FROM deck_candidate_card",
                )
                .get(),
        ).toEqual({
            id: "membership",
            quantity: 30,
            section: "mainboard",
            sort_order: 7,
            note: "Keep note",
        });
        expect(
            db.$client.query("SELECT * FROM deck_candidate_option").all(),
        ).toEqual([]);
        expect(db.$client.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
        closeDatabase(db);
    }
});
