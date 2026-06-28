import {describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sql} from "drizzle-orm";
import {closeDatabase, openDatabase} from "@mtg-agent/sqlite";

describe("SQLite migrations", () => {
    test("0003 preserves dependent rows while making game_changer required", () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-migration-0003-")), "test.sqlite");
        const db = openDatabase(dbPath);
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
        throw error;
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
