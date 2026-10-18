import {eq} from "drizzle-orm";
import {err, ok} from "neverthrow";
import {CardPrintingSchema, ScryfallBulkDataImportSchema, type CardLookupRepository, type CardTags, type LocalLookupRecord} from "@tomekin/core";
import type {TomekinDatabase} from "./database";
import {cardIdentity, cardPrinting, cardPrintingFinish, cardPrintingPromoType, cardSet, scryfallBulkDataImport} from "./schema";

export function createSqliteCardLookupRepository(db: TomekinDatabase): CardLookupRepository {
    return {async readSnapshot(references, includeTags) {
        try {
            // Synchronous transaction establishes one local read view including successful-import revisions.
            const snapshot = db.transaction(() => {
                const imports = db.select().from(scryfallBulkDataImport).all().map((row) => ScryfallBulkDataImportSchema.parse({...row, warnings: row.warningsJson, blockingErrors: row.blockingErrorsJson}));
                const records = references.map((reference): LocalLookupRecord | null => {
                    const printing = reference.kind === "printing_id" ? db.select().from(cardPrinting).where(eq(cardPrinting.id, reference.value)).get() : undefined;
                    if (reference.kind === "printing_id" && !printing) return null;
                    const identity = reference.kind === "name"
                        ? db.select().from(cardIdentity).where(eq(cardIdentity.name, reference.value)).get()
                        : db.select().from(cardIdentity).where(eq(cardIdentity.id, printing?.cardIdentityId ?? reference.value)).get();
                    if (!identity) return null;
                    const detail = readCardIdentityDetail(db, identity.id);
                    const set = printing ? db.select().from(cardSet).where(eq(cardSet.id, printing.setId)).get() : undefined;
                    if (printing && !set) throw new Error("Printing has no Set reference.");
                    return {detail, ...(printing ? {printing: CardPrintingSchema.parse({...printing, finishes: db.select().from(cardPrintingFinish).where(eq(cardPrintingFinish.cardPrintingId, printing.id)).all().map((row) => row.finish).sort()}), set: set!, promoTypes: db.select().from(cardPrintingPromoType).where(eq(cardPrintingPromoType.cardPrintingId, printing.id)).all().map((row) => row.promoType).sort()} : {}), ...(includeTags ? {tags: tagsFor(db, identity.id)} : {})};
                });
                return {imports, records};
            });
            return ok(snapshot);
        } catch (error) { return err({type: "repository_error" as const, message: error instanceof Error ? error.message : String(error)}); }
    }};
}

// The same detail mapper backs retained validation/legacy reads and selected lookup.
import {readCardIdentityDetail} from "./card-reference-detail";
function tagsFor(db: TomekinDatabase, id: string): CardTags {
    const direct = db.$client.prepare(`SELECT tag.slug, tagging.weight, tagging.annotation FROM card_identity_tagging tagging JOIN card_identity_tag tag ON tag.id = tagging.tag_id WHERE tagging.card_identity_id = ? ORDER BY tag.slug`).all(id) as CardTags["direct"];
    const inherited = db.$client.prepare(`WITH RECURSIVE ancestors(tag_id, weight) AS (
        SELECT hierarchy.parent_tag_id, tagging.weight FROM card_identity_tagging tagging JOIN card_identity_tag_hierarchy hierarchy ON hierarchy.child_tag_id = tagging.tag_id WHERE tagging.card_identity_id = ?1
        UNION
        SELECT hierarchy.parent_tag_id, ancestors.weight FROM ancestors JOIN card_identity_tag_hierarchy hierarchy ON hierarchy.child_tag_id = ancestors.tag_id
    ) SELECT tag.slug, CASE min(CASE ancestors.weight WHEN 'very_strong' THEN 0 WHEN 'strong' THEN 1 WHEN 'median' THEN 2 ELSE 3 END) WHEN 0 THEN 'very_strong' WHEN 1 THEN 'strong' WHEN 2 THEN 'median' ELSE 'weak' END AS weight FROM ancestors JOIN card_identity_tag tag ON tag.id = ancestors.tag_id WHERE NOT EXISTS (SELECT 1 FROM card_identity_tagging direct WHERE direct.card_identity_id = ?1 AND direct.tag_id = ancestors.tag_id) GROUP BY tag.id, tag.slug ORDER BY tag.slug`).all(id) as CardTags["inherited"];
    return {direct, inherited};
}
