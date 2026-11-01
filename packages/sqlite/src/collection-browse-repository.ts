import {err, ok} from "neverthrow";
import {ScryfallBulkDataImportSchema, type CollectionBrowseRepository, type OwnedRowFacts} from "@tomekin/core";
import type {TomekinDatabase} from "./database";
import {collectionImport, collectionLocation, collectionState, scryfallBulkDataImport} from "./schema";
import {eq, sql} from "drizzle-orm";

export function createSqliteCollectionBrowseRepository(db: TomekinDatabase): CollectionBrowseRepository {
    return {
        async readCollectionPolicySnapshot() {
            try {
                return ok(db.transaction(() => {
                    const state = db.select().from(collectionState).get();
                    const active = state ? db.select().from(collectionImport).where(eq(collectionImport.id, state.activeImportId)).get() : undefined;
                    if (state && (!active || active.status !== "succeeded")) throw new Error("Active Collection snapshot is not a successful import.");
                    return {activeImport: active ? {id: active.id, imported_at: active.importedAt.toISOString()} : null, legacySnapshot: !state && !!db.select().from(collectionImport).where(eq(collectionImport.status, "succeeded")).get(), locations: db.select().from(collectionLocation).all(), referenceImports: db.select().from(scryfallBulkDataImport).orderBy(sql`rowid DESC`).all().map(row => ScryfallBulkDataImportSchema.parse({...row, warnings: row.warningsJson, blockingErrors: row.blockingErrorsJson}))};
                }));
            } catch (error) {return err(repositoryError(error));}
        },
        async collectionCardIdsExist(ids) {
            try {return ok(ids.every(id => !!db.$client.prepare("SELECT 1 FROM collection_card WHERE id = ?").get(id)));}
            catch (error) {return err(repositoryError(error));}
        },
        async readOwnedRows(input) {
            try {
                return ok(db.transaction(() => {
                    const clauses: string[] = [], params: (string | number)[] = [];
                    for (const [column, values] of [["p.card_identity_id", input.oracle_ids], ["c.card_printing_id", input.printing_ids]] as const) if (values) {
                        clauses.push(values.length ? `${column} IN (${values.map(() => "?").join(",")})` : "0"); params.push(...values);
                    }
                    const order = input.order === "source_order" ? "c.source_row_number ASC, c.id ASC" : `c.added_at_exact IS NULL ASC, c.added_at_exact ${input.order === "added_at_desc" ? "DESC" : "ASC"}, c.id ASC`;
                    const rows = db.$client.prepare(`SELECT c.id AS collection_card_id, p.card_identity_id AS oracle_id, p.id AS printing_id, c.quantity, l.id AS location_id, l.type AS location_type, l.name AS location_name,
                        c.added_at_exact AS added_at, c.added_at AS legacy_added_at, c.finish, c.condition, c.altered, c.misprint, c.purchase_price, c.purchase_price_currency, c.source_row_number,
                        s.code AS "set", s.id AS set_id, s.name AS set_name, s.set_type, p.language AS lang, p.collector_number, p.printed_name, p.layout AS printing_layout, p.tcgplayer_id, p.cardmarket_id
                        FROM collection_card c JOIN collection_location l ON l.id = c.collection_location_id JOIN card_printing p ON p.id = c.card_printing_id JOIN card_set s ON s.id = p.set_id
                        ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, input.first, input.offset) as (Omit<OwnedRowFacts, "location" | "date_reliability" | "finishes" | "promo_types" | "altered" | "misprint"> & {location_id: string; location_type: "binder" | "deck"; location_name: string; legacy_added_at: number | null; altered: number; misprint: number})[];
                    return rows.map(({location_id, location_type, location_name, legacy_added_at, ...row}): OwnedRowFacts => ({...row, altered: !!row.altered, misprint: !!row.misprint, location: {id: location_id, type: location_type, name: location_name}, date_reliability: row.added_at ? "source" : legacy_added_at === null ? "unknown" : "legacy_precision_lost", finishes: (db.$client.prepare("SELECT finish FROM card_printing_finish WHERE card_printing_id = ? ORDER BY finish").all(row.printing_id) as {finish: string}[]).map(row => row.finish), promo_types: (db.$client.prepare("SELECT promo_type FROM card_printing_promo_type WHERE card_printing_id = ? ORDER BY promo_type").all(row.printing_id) as {promo_type: string}[]).map(row => row.promo_type)}));
                }));
            } catch (error) {return err(repositoryError(error));}
        },
    };
}
function repositoryError(error: unknown) {return {type: "repository_error" as const, message: error instanceof Error ? error.message : String(error)};}
