import {err,ok} from "neverthrow";
import {type DeckCandidate, roleSelectedCopies} from "./deck-candidate";
export type CandidatePlanExportOptions = {format:string;projection?:string};
const compare = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
// Generated identifiers contain no authored syntax and do not change when labels/order change.
const nodeId = (id: string) => `n_${Buffer.from(id).toString("hex")}`;
const cardId = (id: string) => `c_${Buffer.from(id).toString("hex")}`;
const label = (text: string) => [...text].map(c => /["&<>#`|\[\]{}\\]/.test(c) ? `#${c.codePointAt(0)};` : /[\r\n\u0000-\u001f\u007f]/.test(c) ? " " : c).join("");
export function exportCandidatePlan(candidate: DeckCandidate, options: CandidatePlanExportOptions) {
    const projection = options.projection ?? "strategy";
    const fail = (message: string) => err({type:"validation_error" as const,message});
    if (options.format !== "json" && options.format !== "mermaid") return fail("Unsupported export format. Choose json or mermaid.");
    if (!["strategy","selected","pool"].includes(projection)) return fail("Unsupported projection. Choose strategy, selected or pool.");
    if (!candidate.plan) return fail(`Deck Candidate ${candidate.id} has no current Deck Plan. Save a plan before exporting it.`);
    // JSON remains the complete domain document regardless of the requested display projection.
    if (options.format === "json") return ok(`${JSON.stringify({schema_version:1,projection,candidate},null,2)}\n`);
    const lines = ["---", "config:", "  htmlLabels: true", "---", "flowchart LR", `  %% Candidate ${candidate.id}; updated ${candidate.updatedAt}; projection ${projection}`, `  context["${label(`${candidate.label} (${projection})`)}"]`, '  subgraph strategy["Current strategy"]'];
    for (const node of [...candidate.plan.nodes].sort((a,b)=>compare(a.id,b.id))) {
        if (node.kind === "win_route") lines.push(`    ${nodeId(node.id)}["${label(`${node.label} (${node.priority})`)}"]:::route`);
        else {
            const copies = roleSelectedCopies(candidate,node);
            const gap = copies === 0 || (node.coverage_goal?.minimum_copies != null && copies < node.coverage_goal.minimum_copies);
            const sections = node.coverage_goal?.sections.join(", ") ?? "all sections";
            lines.push(`    ${nodeId(node.id)}["${label(`${gap ? "Gap: " : ""}${node.label} (${copies} selected copies; ${sections})`)}"]:::${gap?"gap":"role"}`);
        }
    }
    lines.push("  end");
    for (const r of [...candidate.plan.relationships].sort((a,b)=>compare(`${a.kind}/${a.source_id}/${a.target_id}/${a.id}`,`${b.kind}/${b.source_id}/${b.target_id}/${b.id}`))) lines.push(`  ${nodeId(r.source_id)} ${r.kind === "competes_with" ? "---" : "-->"}|"${r.kind}"| ${nodeId(r.target_id)}`);
    if (projection !== "strategy") {
        lines.push(`  subgraph cards["${projection === "pool" ? "Assessed options" : "Selected contributors"}"]`);
        const shown = new Set<string>();
        for (const option of [...candidate.options].sort((a,b)=>compare(a.card_identity_id,b.card_identity_id))) {
            const memberships = candidate.memberships.filter(m=>m.card_identity_id===option.card_identity_id).sort((a,b)=>compare(a.section,b.section));
            if (projection === "selected" && !memberships.length) continue;
            shown.add(option.card_identity_id);
            const quantity = memberships.length ? memberships.map(m=>`${m.quantity} ${m.section}`).join("; ") : "Pool only";
            lines.push(`    ${cardId(option.card_identity_id)}["${label(`${option.card_name ?? option.card_identity_id} (${quantity})`)}"]:::${memberships.length?"selected":"alternative"}`);
        }
        lines.push("  end");
        for (const c of [...candidate.plan.contributions].sort((a,b)=>compare(`${a.card_identity_id}/${a.role_id}`,`${b.card_identity_id}/${b.role_id}`))) if (shown.has(c.card_identity_id)) lines.push(`  ${cardId(c.card_identity_id)} -.->|"contributes"| ${nodeId(c.role_id)}`);
    }
    lines.push('  subgraph legend["Legend: inspection only; counts do not prove adequacy"]', '    legend_role["Role / desired gap; Win Route: primary or secondary"]:::role', '    legend_edges["Arrows: enables / enhances / supports; line: symmetric competes_with"]', '    legend_selected["Selected: quantities by section; pool only: alternative with zero selected coverage"]:::selected', "  end", "  classDef role fill:#e8f0fe,stroke:#355c91,color:#17233b", "  classDef gap fill:#fff4d4,stroke:#9b6700,stroke-dasharray:5 3,color:#3b2800", "  classDef route fill:#e1f4e7,stroke:#23783c,color:#153d21", "  classDef selected fill:#e5efff,stroke:#325fa8,color:#17233b", "  classDef alternative fill:#f3edf8,stroke:#78518f,stroke-dasharray:3 3,color:#392343");
    return ok(`${lines.join("\n")}\n`);
}
