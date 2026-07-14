import type {CardIdentity, CardIdentityFormatLegality, CardIdentityPart} from "./scryfall-sync";
import type {DeckBuildingBrief} from "./deck-building-brief";

export type CommanderDeckCard = {
  readonly card: CardIdentity;
  readonly quantity: number;
  readonly section: "commander" | "deck";
  readonly legalities?: readonly CardIdentityFormatLegality[];
  readonly parts?: readonly CardIdentityPart[];
};

export type CommanderLegalityStatus = "legal" | "illegal" | "unsupported";

export type CommanderLegalityResult = {
  readonly status: CommanderLegalityStatus;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
};

const basicLandNames = new Set(["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"]);

export function isCommanderEligible(card: CardIdentity, parts: readonly CardIdentityPart[] = []): boolean {
  const typeLine = joinedTypeLine(card, parts);
  const oracleText = joinedOracleText(card, parts);
  return /legendary/i.test(typeLine) && /creature/i.test(typeLine)
    || /can be your commander/i.test(oracleText)
    || /friends forever/i.test(oracleText)
    || /choose a background/i.test(oracleText)
    || /doctor's companion/i.test(oracleText)
    || /^partner(\s|$)/im.test(oracleText)
    || /partner with /i.test(oracleText);
}

export function validateCommanderSection(cards: readonly CommanderDeckCard[]): CommanderLegalityResult {
  const commanders = cards.filter((card) => card.section === "commander");
  if (commanders.length === 0) return illegal("Deck has no Commander section cards.");
  const firstCommander = commanders[0];
  if (commanders.length === 1) {
    if (!firstCommander) return illegal("Deck has no Commander section cards.");
    return isCommanderEligible(firstCommander.card, firstCommander.parts ?? []) ? legal() : illegal(`${firstCommander.card.name} is not locally recognized as commander-eligible.`);
  }
  if (commanders.length === 2 && supportsKnownPartnerPair(commanders)) return legal();
  return unsupported(`Commander section contains ${commanders.length} cards, but the local validator only supports common two-commander mechanics.`);
}

export function validateCommanderDeck(cards: readonly CommanderDeckCard[], brief?: DeckBuildingBrief): CommanderLegalityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const commanderResult = validateCommanderSection(cards);
  reasons.push(...commanderResult.reasons);
  warnings.push(...commanderResult.warnings);

  const ruleZero = (brief?.ruleZeroExceptions.length ?? 0) > 0;
  const size = cards.reduce((sum, row) => sum + row.quantity, 0);
  if (size !== 100 && !ruleZero) reasons.push(`Commander deck size is ${size}; expected exactly 100 cards including commander section.`);

  const commanderColorIdentity = mergeColorIdentities(cards.filter((card) => card.section === "commander").map((card) => card.card.colorIdentity));
  const quantityByName = new Map<string, number>();
  for (const row of cards) {
    quantityByName.set(row.card.name, (quantityByName.get(row.card.name) ?? 0) + row.quantity);
    if (row.section === "deck" && !isColorSubset(row.card.colorIdentity, commanderColorIdentity)) {
      reasons.push(`${row.card.name} has color identity ${row.card.colorIdentity || "colorless"}, outside commander identity ${commanderColorIdentity || "colorless"}.`);
    }
    const commanderLegality = row.legalities?.find((legality) => legality.format === "commander")?.legality;
    if (commanderLegality && commanderLegality !== "legal") reasons.push(`${row.card.name} is ${commanderLegality} in Commander according to local Scryfall data.`);
  }
  for (const [name, quantity] of quantityByName) {
    if (quantity > 1 && !basicLandNames.has(name)) reasons.push(`${name} appears ${quantity} times; Commander singleton allows only one non-basic copy.`);
  }
  if (ruleZero) warnings.push("Rule Zero exceptions are present in the confirmed brief; deterministic legality issues must be labelled in output.");

  if (commanderResult.status === "unsupported") return {status: "unsupported", reasons, warnings};
  return reasons.length === 0 ? {status: "legal", reasons: [], warnings} : {status: "illegal", reasons, warnings};
}

function legal(): CommanderLegalityResult { return {status: "legal", reasons: [], warnings: []}; }
function illegal(reason: string): CommanderLegalityResult { return {status: "illegal", reasons: [reason], warnings: []}; }
function unsupported(reason: string): CommanderLegalityResult { return {status: "unsupported", reasons: [reason], warnings: []}; }

function supportsKnownPartnerPair(commanders: readonly CommanderDeckCard[]): boolean {
  const first = commanders[0];
  const second = commanders[1];
  if (!first || !second) return false;
  const texts = commanders.map((card) => joinedOracleText(card.card, card.parts));
  const typeLines = commanders.map((card) => joinedTypeLine(card.card, card.parts));
  if (texts.every((text) => /^partner(\s|$)/im.test(text))) return true;
  if (texts.every((text) => /friends forever/i.test(text))) return true;
  if (texts.some((text) => /choose a background/i.test(text)) && typeLines.some((line) => /background/i.test(line))) return true;
  if (texts.some((text) => /doctor's companion/i.test(text)) && typeLines.some((line) => /time lord doctor/i.test(line))) return true;
  return texts[0]?.toLowerCase().includes(`partner with ${second.card.name.toLowerCase()}`) === true
    && texts[1]?.toLowerCase().includes(`partner with ${first.card.name.toLowerCase()}`) === true;
}

function joinedTypeLine(card: CardIdentity, parts: readonly CardIdentityPart[] = []): string {
  return [card.typeLine, ...parts.map((part) => part.typeLine ?? "")].join("\n");
}

function joinedOracleText(card: CardIdentity, parts: readonly CardIdentityPart[] = []): string {
  return [card.oracleText ?? "", ...parts.map((part) => part.oracleText ?? "")].join("\n");
}

function mergeColorIdentities(values: readonly string[]): string {
  return ["W", "U", "B", "R", "G"].filter((color) => values.some((value) => value.includes(color))).join("");
}

function isColorSubset(value: string, allowed: string): boolean {
  return [...value].every((color) => allowed.includes(color));
}
