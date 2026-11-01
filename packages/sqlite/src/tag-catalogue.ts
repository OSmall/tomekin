import {eq, inArray} from "drizzle-orm";
import type {BrowseTagsArgs, TagDefinition, TagHierarchy, TagCatalogueSnapshot, TagCatalogueOutcome} from "@tomekin/core";
import type {TomekinDatabase} from "./database";
import {cardIdentityTag, cardIdentityTagAlias, cardIdentityTagHierarchy} from "./schema";
import {readReferenceSupport} from "./card-reference-repository";

/** One SQLite read transaction keeps catalogue rows and successful-import binding coherent. */
export function readTagCatalogue(db: TomekinDatabase, operation: BrowseTagsArgs["operation"], offset: number, limit: number): TagCatalogueSnapshot {
    return db.transaction(tx => {
        const definition = (id: string): TagDefinition => {
            const tag = tx.select().from(cardIdentityTag).where(eq(cardIdentityTag.id, id)).get()!;
            return {id: tag.id, slug: tag.slug, label: tag.label, description: tag.description, source_page_uri: tag.sourcePageUri, aliases: tx.select().from(cardIdentityTagAlias).where(eq(cardIdentityTagAlias.tagId, id)).all().map(a => a.alias).sort()};
        };
        const hierarchy = (id: string, depth: number): TagHierarchy => {
            const relationships = new Map<string, {parent_slug: string; child_slug: string}>();
            const explore = (direction: "parents" | "children") => {
                const seen = new Set([id]); let frontier = [id]; const related: TagDefinition[] = [];
                for (let level = 0; level < depth && frontier.length; level++) {
                    const rows = tx.select().from(cardIdentityTagHierarchy).where(inArray(direction === "parents" ? cardIdentityTagHierarchy.childTagId : cardIdentityTagHierarchy.parentTagId, frontier)).all();
                    const next: string[] = [];
                    for (const edge of rows) {
                        const parent = definition(edge.parentTagId), child = definition(edge.childTagId);
                        relationships.set(`${parent.id}/${child.id}`, {parent_slug: parent.slug, child_slug: child.slug});
                        const neighbor = direction === "parents" ? parent : child;
                        if (!seen.has(neighbor.id)) {seen.add(neighbor.id); next.push(neighbor.id); related.push(neighbor);}
                    }
                    frontier = next;
                }
                return related.sort((a,b) => a.slug.localeCompare(b.slug));
            };
            const parents = explore("parents"), children = explore("children");
            return {depth, parents, children, relationships: [...relationships.values()].sort((a,b) => a.parent_slug.localeCompare(b.parent_slug) || a.child_slug.localeCompare(b.child_slug))};
        };
        const found = (id: string): TagCatalogueOutcome => ({status: "found", tag: definition(id), ...(operation.type === "lookup" && operation.hierarchy ? {hierarchy: hierarchy(id, operation.hierarchy.depth)} : {})});
        let outcomes: TagCatalogueOutcome[];
        if (operation.type === "lookup") outcomes = operation.slugs.slice(offset, offset + limit).map(slug => {
            const tag = tx.select({id: cardIdentityTag.id}).from(cardIdentityTag).where(eq(cardIdentityTag.slug, slug)).get();
            return tag ? found(tag.id) : {status: "not_found", slug};
        });
        else {
            const query = operation.type === "search" ? operation.query.toLowerCase() : "";
            // instr is literal substring matching, so '%'/'_' in search terms are not SQL wildcards.
            const ids = db.$client.prepare(`SELECT t.id FROM card_identity_tag t WHERE ?1 = '' OR instr(lower(t.slug), ?1) > 0 OR instr(lower(t.label), ?1) > 0 OR EXISTS (SELECT 1 FROM card_identity_tag_alias a WHERE a.tag_id = t.id AND instr(lower(a.alias), ?1) > 0) ORDER BY t.slug, t.id LIMIT ?2 OFFSET ?3`).all(query, limit, offset) as {id: string}[];
            outcomes = ids.map(t => found(t.id));
        }
        return {imports: readReferenceSupport(tx).imports, outcomes};
    });
}
