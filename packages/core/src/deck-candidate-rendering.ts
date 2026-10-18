import {roleSelectedCopies, summarizeDeckCandidate, type DeckCandidate, type DeckCandidateCard} from "./deck-candidate";
import type {DeckFormat} from "./deck-building-brief";

export type RenderDeckCandidateInput = {
  readonly label: string;
    readonly format: DeckFormat;
  readonly cards: readonly DeckCandidateCard[];
  readonly sections?: Partial<Record<DeckCandidateMarkdownSection, string>> | undefined;
};

export const deckCandidateMarkdownSections = [
  "Game Plan",
  "Power And Experience",
  "Legality Assessment",
  "Deck Structure",
  "Portable Decklist",
  "Collection Status",
  "Key Synergies",
  "Interaction And Protection",
  "Mana And Curve",
  "Optional Upgrades",
  "Cuts And Exclusions",
  "Assumptions And Caveats",
] as const;
export type DeckCandidateMarkdownSection = (typeof deckCandidateMarkdownSections)[number];

export function renderPortableDecklist(format: DeckFormat, cards: readonly DeckCandidateCard[]): string {
    const sections: string[] = [];
    const commanders = cards.filter(card => card.section === "commander");
    if (format === "commander" || commanders.length) sections.push(renderDecklistSection("Commander", commanders));
    sections.push(renderDecklistSection("Mainboard", cards.filter(card => card.section === "mainboard")));
    const sideboard = cards.filter(card => card.section === "sideboard");
    if (sideboard.length) sections.push(renderDecklistSection("Sideboard", sideboard));
    return sections.join("\n\n");
}

export function renderDeckCandidateMarkdown(input: RenderDeckCandidateInput): string {
    const portable = renderPortableDecklist(input.format, input.cards);
  const sections = input.sections ?? {};
  const body = deckCandidateMarkdownSections.map((section) => {
    const content = section === "Portable Decklist"
      ? `\`\`\`txt\n${portable}\n\`\`\``
      : sections[section] ?? defaultSectionContent(section);
    return `## ${section}\n\n${content}`;
  });
  return `# ${input.label}\n\n${body.join("\n\n")}`;
}

export function renderSavedDeckCandidate(candidate: DeckCandidate): {readonly markdown: string; readonly portableDecklist: string} {
  return {
    markdown: renderCandidateReportParts(candidate).join(""),
      portableDecklist: renderPortableDecklist(candidate.format, candidate.cards),
  };
}

function renderDecklistSection(label: string, cards: readonly DeckCandidateCard[]): string {
  const rows = [...cards]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.cardName.localeCompare(b.cardName))
    .map((card) => `${card.quantity} ${card.cardName}`);
  return [label, ...rows].join("\n");
}

function defaultSectionContent(section: DeckCandidateMarkdownSection): string {
    if (section === "Collection Status") return "Collection availability was not recorded for this Deck Candidate. Check the current imported Collection before treating cards as Missing Cards.";
  if (section === "Cuts And Exclusions") return "No meaningful cuts or exclusions were recorded.";
  return "Not recorded.";
}

/** Ordered complete report fragments; join with the empty string to render Markdown. */
export function renderCandidateReportParts(candidate: DeckCandidate): string[] {
    const json = (value: unknown) => `\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
    const availability=candidate.validation_evidence?.checks?.collection_availability;
    const collectionStatus=!availability||availability.status==="absent"?"Current Availability and Collection Pull List evidence is unrecorded.":availability.status==="outdated"?"Availability evidence is outdated. Reconfirm scope and explicitly recheck before assembly.":`Availability was explicitly checked at ${availability.checked_at}. Recover complete requirements and row witnesses with the availability or collection_pull_list view. ${JSON.stringify((availability.result as import("./collection-availability").AvailabilityResult).summary)}`;
    const parts = [`# ${candidate.label}\n\nCandidate ${candidate.id}; updated ${candidate.updatedAt}.\n\n`, "## Deck Building Brief", json(candidate.brief), "## Game Plan\n\n", `${candidate.plan?.description ?? "Unrecorded."}\n\n`, "## Power And Experience\n\n", `${candidate.assessments.power_play_experience_fit ?? "Unrecorded."}\n\n`, "## Mana And Curve\n\n", `${candidate.assessments.mana_curve_adequacy ?? "Unrecorded."}\n\n`, "## Explicit Check Evidence", json(candidate.validation_evidence ?? summarizeDeckCandidate(candidate).validation_evidence), `## Collection Status\n\n${collectionStatus} Historical contribution/source notes do not establish current owned-copy proof.\n\n`, "## Portable Decklist\n\n\`\`\`txt\n", ...renderPortableDecklist(candidate.format, candidate.cards).split("\n").map(line=>`${line}\n`), "\`\`\`\n\n", "## Selected Membership\n\n"];
    for (const membership of candidate.memberships) parts.push(json(membership));
    parts.push("## Roles And Win Routes\n\n");
    for (const node of candidate.plan?.nodes ?? []) parts.push(json(node.kind === "role" ? {...node, selected_copies:roleSelectedCopies(candidate,node), assessment_status:node.coverage_assessment ? "recorded" : "unrecorded"} : node));
    parts.push("## Relationships\n\n");
    for (const relationship of candidate.plan?.relationships ?? []) parts.push(json(relationship));
    parts.push("## Deck Card Pool And Contributions\n\nPool options include alternatives; only Selected Membership contributes selected quantities.\n\n");
    for (const option of candidate.options) {
        parts.push(json(option));
        for (const contribution of candidate.plan?.contributions.filter(c => c.card_identity_id === option.card_identity_id) ?? []) parts.push(json(contribution));
    }
    return parts;
}
