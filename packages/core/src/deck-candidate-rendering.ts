import type {DeckCandidate, DeckCandidateCard} from "./deck-candidate";
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
    const mainboard = renderDecklistSection("Mainboard", cards.filter((card) => card.section === "mainboard"));
    if (format === "commander") {
        const commander = renderDecklistSection("Commander", cards.filter((card) => card.section === "commander"));
        return `${commander}\n\n${mainboard}`;
    }
    const sideboardCards = cards.filter((card) => card.section === "sideboard");
    return sideboardCards.length === 0
        ? mainboard
        : `${mainboard}\n\n${renderDecklistSection("Sideboard", sideboardCards)}`;
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
    markdown: renderDeckCandidateMarkdown({label:candidate.label,format:candidate.format,cards:candidate.cards,sections:{"Game Plan":candidate.plan?.description??"Not recorded."}}),
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
