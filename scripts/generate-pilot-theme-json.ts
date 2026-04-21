import { createOpencode } from "@opencode-ai/sdk/v2";
import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type CsvRow = Record<string, string>;

type InventoryRow = {
  binder_name: string;
  binder_type: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  foil: string;
  rarity: string;
  quantity: number;
  manabox_id: number | null;
  scryfall_id: string;
  purchase_price: number | null;
  purchase_price_currency: string | null;
  misprint: boolean;
  altered: boolean;
  condition: string;
  language: string;
};

type Legalities = {
  commander: string;
  modern: string;
  pioneer: string;
  standard: string;
  pauper: string;
};

type FinalThemeAssignment = {
  primary: boolean;
  category: string;
  theme: string;
  role: Role;
  strength: 1 | 2 | 3;
  confidence: number;
  reasoning_notes: string;
};

type PilotCard = {
  oracle_id: string;
  name: string;
  mana_cost: string;
  mana_value: number;
  type_line: string;
  oracle_text: string;
  keywords: string[];
  color_identity: string[];
  edhrec_rank: number | null;
  legalities: Legalities;
  quantity_total: number;
  quantity_in_binders: number;
  quantity_in_decks: number;
  scryfall_ids: string[];
  inventory: InventoryRow[];
  themes: FinalThemeAssignment[];
};

type ClassificationCard = Omit<PilotCard, "themes"> & {
  power: string | null;
  toughness: string | null;
  card_faces: Array<{
    name: string;
    mana_cost: string;
    type_line: string;
    oracle_text: string;
  }>;
};

type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line: string;
  oracle_text?: string;
  keywords?: string[];
  color_identity?: string[];
  edhrec_rank?: number;
  power?: string;
  toughness?: string;
  legalities?: Record<string, string>;
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
  }>;
};

type ClassifierThemeCandidate = {
  primary: boolean;
  theme: string;
  category_hint?: string;
  role: string;
  strength: number;
  confidence: number;
  reasoning_notes: string;
};

type ClassifierResponse = {
  themes: ClassifierThemeCandidate[];
};

type AuditReason = "low_confidence" | "broad_tagging" | "high_impact" | "proposed_theme";

type Checkpoint = {
  oracle_id: string;
  name: string;
  first_pass?: {
    themes: FinalThemeAssignment[];
    audit_reasons: AuditReason[];
    proposed_themes: string[];
  };
  final?: {
    themes: FinalThemeAssignment[];
    audit_reasons: AuditReason[];
    proposed_themes: string[];
    audited: boolean;
  };
  quarantine?: {
    stage: "first_pass" | "audit";
    error: string;
  };
};

type ThemeVocabularyEntry = {
  theme: string;
  category: string;
};

type ThemeVocabularyState = {
  version: string;
  entries: Map<string, ThemeVocabularyEntry>;
  seedThemes: Set<string>;
};

type PilotDataset = {
  schema_version: string;
  generated_at: string;
  source: {
    collection_csv: string;
    pilot_sample_csv: string;
    ownership_unit: string;
    gameplay_identity_unit: string;
    excluded_cards: {
      basic_lands: number;
    };
  };
  classification_policy: {
    model: string;
    variant: string;
    primary_theme_required: boolean;
    secondary_theme_guideline: string;
    confidence_definition: string;
    audit_thresholds: {
      confidence_below: number;
      theme_count_above: number;
    };
    role_vocabulary: Role[];
    strength_scale: Record<string, string>;
  };
  run_summary: {
    oracle_cards_total: number;
    oracle_cards_classified: number;
    oracle_cards_quarantined: number;
    cards_audited: number;
  };
  theme_vocabulary: {
    version: string;
    themes: ThemeVocabularyEntry[];
  };
  cards: PilotCard[];
};

type Role = "payoff" | "enabler" | "engine" | "interaction" | "support" | "finisher" | "ramp" | "draw";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data");
const DEFAULT_INPUT_PATH = join(DATA_DIR, "pilot_every_10th_120.csv");
const DEFAULT_OUTPUT_PATH = join(DATA_DIR, "pilot_theme_dataset.json");
const INPUT_PATH = Bun.env.COLLECTION_CSV ?? Bun.env.INPUT_CSV ?? DEFAULT_INPUT_PATH;
const OUTPUT_PATH = Bun.env.OUTPUT_JSON ?? DEFAULT_OUTPUT_PATH;
const CACHE_DIR = join(DATA_DIR, "scryfall-cache");
const DEFAULT_CHECKPOINT_DIR = join(DATA_DIR, "pilot-theme-checkpoints");
const CHECKPOINT_DIR = Bun.env.CHECKPOINT_DIR ?? DEFAULT_CHECKPOINT_DIR;
const SCRYFALL_API = "https://api.scryfall.com/cards";
const SKIP_REMAINING_AUDIT = parseBoolean(Bun.env.SKIP_REMAINING_AUDIT ?? "");

const MODEL = {
  providerID: "openai",
  modelID: "gpt-5.4",
  variant: "low",
} as const;

const PILOT_LIMIT = parseInteger(Bun.env.PILOT_LIMIT ?? "") ?? null;
const CONCURRENCY = Math.max(1, parseInteger(Bun.env.PILOT_CONCURRENCY ?? Bun.env.PILOT_BATCH_SIZE ?? "") ?? 10);

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const BROAD_THEME_THRESHOLD = 3;

const ROLE_VOCABULARY: Role[] = [
  "payoff",
  "enabler",
  "engine",
  "interaction",
  "support",
  "finisher",
  "ramp",
  "draw",
];

const BASIC_LAND_NAMES = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
  "snow-covered plains",
  "snow-covered island",
  "snow-covered swamp",
  "snow-covered mountain",
  "snow-covered forest",
]);

const SEED_THEME_VOCABULARY: Array<ThemeVocabularyEntry> = [
  { category: "lifegain", theme: "lifegain" },
  { category: "lifegain", theme: "lifegain payoffs" },
  { category: "lifegain", theme: "lifegain-drain" },
  { category: "counters", theme: "+1/+1 counters" },
  { category: "counters", theme: "proliferate" },
  { category: "tokens", theme: "tokens" },
  { category: "tokens", theme: "go-wide" },
  { category: "sacrifice", theme: "sacrifice" },
  { category: "sacrifice", theme: "aristocrats" },
  { category: "graveyard", theme: "mill" },
  { category: "graveyard", theme: "self-mill" },
  { category: "graveyard", theme: "graveyard recursion" },
  { category: "graveyard", theme: "reanimator" },
  { category: "spells", theme: "spellslinger" },
  { category: "spells", theme: "prowess / spell-matter" },
  { category: "spells", theme: "heroic" },
  { category: "artifacts", theme: "artifacts" },
  { category: "artifacts", theme: "equipment" },
  { category: "enchantments", theme: "auras" },
  { category: "mana", theme: "ramp" },
  { category: "mana", theme: "big mana" },
  { category: "mana", theme: "mana fixing" },
  { category: "mana", theme: "landfall" },
  { category: "interaction", theme: "control" },
  { category: "interaction", theme: "tempo" },
  { category: "interaction", theme: "discard" },
  { category: "interaction", theme: "blink" },
  { category: "interaction", theme: "combat tricks" },
  { category: "interaction", theme: "spot removal" },
  { category: "interaction", theme: "card draw" },
  { category: "tribal", theme: "tribal" },
  { category: "poison", theme: "infect / proliferate" },
  { category: "midrange", theme: "midrange threats" },
];

const THEME_SYNONYMS = new Map<string, string>([
  [normalizeLookupKey("lifegain payoff"), "lifegain payoffs"],
  [normalizeLookupKey("lifegain payoffs"), "lifegain payoffs"],
  [normalizeLookupKey("counter synergies"), "+1/+1 counters"],
  [normalizeLookupKey("+1/+1 counter"), "+1/+1 counters"],
  [normalizeLookupKey("go wide"), "go-wide"],
  [normalizeLookupKey("go-wide tokens"), "go-wide"],
  [normalizeLookupKey("spell matter"), "prowess / spell-matter"],
  [normalizeLookupKey("spell-matter"), "prowess / spell-matter"],
  [normalizeLookupKey("spells matter"), "prowess / spell-matter"],
  [normalizeLookupKey("prowess"), "prowess / spell-matter"],
  [normalizeLookupKey("graveyard recursion"), "graveyard recursion"],
  [normalizeLookupKey("graveyard recursion payoffs"), "graveyard recursion"],
  [normalizeLookupKey("artifact synergies"), "artifacts"],
  [normalizeLookupKey("equipment matters"), "equipment"],
  [normalizeLookupKey("card advantage"), "card draw"],
  [normalizeLookupKey("removal"), "spot removal"],
  [normalizeLookupKey("spot interaction"), "spot removal"],
  [normalizeLookupKey("combat trick"), "combat tricks"],
  [normalizeLookupKey("mana acceleration"), "ramp"],
  [normalizeLookupKey("fixing"), "mana fixing"],
  [normalizeLookupKey("poison"), "infect / proliferate"],
  [normalizeLookupKey("infect"), "infect / proliferate"],
]);

const CLASSIFIER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["themes"],
  properties: {
    themes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["primary", "theme", "role", "strength", "confidence", "reasoning_notes"],
        properties: {
          primary: { type: "boolean" },
          theme: { type: "string", minLength: 1 },
          category_hint: { type: "string" },
          role: { type: "string", enum: ROLE_VOCABULARY },
          strength: { type: "integer", minimum: 1, maximum: 3 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reasoning_notes: { type: "string", minLength: 1, maxLength: 220 },
        },
      },
    },
  },
} as const;

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ");
}

function toDisplayTheme(value: string): string {
  return normalizeLookupKey(value);
}

function toDisplayCategory(value: string): string {
  return normalizeLookupKey(value).replace(/[.]/g, "");
}

function buildVocabularyState(): ThemeVocabularyState {
  const entries = new Map<string, ThemeVocabularyEntry>();
  const seedThemes = new Set<string>();

  for (const entry of SEED_THEME_VOCABULARY) {
    const normalizedTheme = toDisplayTheme(entry.theme);
    const normalizedCategory = toDisplayCategory(entry.category);
    entries.set(normalizeLookupKey(normalizedTheme), {
      theme: normalizedTheme,
      category: normalizedCategory,
    });
    seedThemes.add(normalizedTheme);
  }

  return {
    version: "pilot-v1",
    entries,
    seedThemes,
  };
}

function extendVocabularyFromThemes(vocabulary: ThemeVocabularyState, themes: FinalThemeAssignment[]) {
  for (const theme of themes) {
    const key = normalizeLookupKey(theme.theme);
    if (!vocabulary.entries.has(key)) {
      vocabulary.entries.set(key, {
        theme: toDisplayTheme(theme.theme),
        category: toDisplayCategory(theme.category),
      });
    }
  }
}

function getVocabularyEntries(vocabulary: ThemeVocabularyState): ThemeVocabularyEntry[] {
  return Array.from(vocabulary.entries.values()).sort((left, right) => {
    const byCategory = left.category.localeCompare(right.category);
    if (byCategory !== 0) {
      return byCategory;
    }
    return left.theme.localeCompare(right.theme);
  });
}

function vocabularyPrompt(vocabulary: ThemeVocabularyState): string {
  const lines = getVocabularyEntries(vocabulary).map((entry) => `- ${entry.theme} [category: ${entry.category}]`);
  return lines.join("\n");
}

function parseCsv(source: string): CsvRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((values) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
}

function parseNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function clampStrength(value: number): 1 | 2 | 3 {
  if (value >= 3) {
    return 3;
  }
  if (value <= 1) {
    return 1;
  }
  return 2;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeRole(value: string): Role {
  const normalized = normalizeLookupKey(value);
  if (ROLE_VOCABULARY.includes(normalized as Role)) {
    return normalized as Role;
  }
  return "support";
}

function isBasicLand(card: ScryfallCard): boolean {
  const name = card.name.toLowerCase();
  return card.type_line.includes("Basic Land") || BASIC_LAND_NAMES.has(name);
}

function getOracleText(card: ScryfallCard): string {
  if (card.oracle_text?.trim()) {
    return card.oracle_text.trim();
  }
  if (!card.card_faces?.length) {
    return "";
  }
  return card.card_faces
    .map((face) => [face.name, face.oracle_text].filter(Boolean).join(": "))
    .join(" // ");
}

function getManaCost(card: ScryfallCard): string {
  if (card.mana_cost?.trim()) {
    return card.mana_cost.trim();
  }
  if (!card.card_faces?.length) {
    return "";
  }
  return card.card_faces.map((face) => face.mana_cost?.trim() ?? "").filter(Boolean).join(" // ");
}

function getCardFaces(card: ScryfallCard): ClassificationCard["card_faces"] {
  return (card.card_faces ?? []).map((face) => ({
    name: face.name,
    mana_cost: face.mana_cost?.trim() ?? "",
    type_line: face.type_line?.trim() ?? "",
    oracle_text: face.oracle_text?.trim() ?? "",
  }));
}

function getLegalities(card: ScryfallCard): Legalities {
  const legalities = card.legalities ?? {};
  return {
    commander: legalities.commander ?? "not_legal",
    modern: legalities.modern ?? "not_legal",
    pioneer: legalities.pioneer ?? "not_legal",
    standard: legalities.standard ?? "not_legal",
    pauper: legalities.pauper ?? "not_legal",
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchScryfallCard(scryfallId: string): Promise<ScryfallCard> {
  const cachePath = join(CACHE_DIR, `${scryfallId}.json`);
  if (await exists(cachePath)) {
    return JSON.parse(await readFile(cachePath, "utf8")) as ScryfallCard;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${SCRYFALL_API}/${scryfallId}`);
      if (!response.ok) {
        throw new Error(`Scryfall ${response.status} for ${scryfallId}`);
      }
      const payload = (await response.json()) as ScryfallCard;
      await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      await Bun.sleep(85);
      return payload;
    } catch (error) {
      lastError = error;
      await Bun.sleep(350 * attempt);
    }
  }

  throw lastError;
}

function toInventoryRow(row: CsvRow): InventoryRow {
  return {
    binder_name: row["Binder Name"],
    binder_type: row["Binder Type"],
    set_code: row["Set code"],
    set_name: row["Set name"],
    collector_number: row["Collector number"],
    foil: row.Foil,
    rarity: row.Rarity,
    quantity: Number(row.Quantity),
    manabox_id: parseInteger(row["ManaBox ID"]),
    scryfall_id: row["Scryfall ID"],
    purchase_price: parseNumber(row["Purchase price"]),
    purchase_price_currency: row["Purchase price currency"] || null,
    misprint: parseBoolean(row.Misprint),
    altered: parseBoolean(row.Altered),
    condition: row.Condition,
    language: row.Language,
  };
}

function checkpointPath(oracleId: string): string {
  return join(CHECKPOINT_DIR, `${oracleId}.json`);
}

async function readCheckpoint(oracleId: string): Promise<Checkpoint | null> {
  const path = checkpointPath(oracleId);
  if (!(await exists(path))) {
    return null;
  }
  return JSON.parse(await readFile(path, "utf8")) as Checkpoint;
}

async function writeCheckpoint(checkpoint: Checkpoint): Promise<void> {
  const path = checkpointPath(checkpoint.oracle_id);
  await writeFile(path, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

function buildCards(rows: CsvRow[], cardsById: Map<string, ScryfallCard>): { cards: ClassificationCard[]; basicLandsExcluded: number } {
  const grouped = new Map<string, ClassificationCard>();
  let basicLandsExcluded = 0;

  for (const row of rows) {
    const scryfallId = row["Scryfall ID"];
    const card = cardsById.get(scryfallId);
    if (!card || !card.oracle_id) {
      continue;
    }

    if (isBasicLand(card)) {
      basicLandsExcluded += 1;
      continue;
    }

    const inventoryRow = toInventoryRow(row);
    const existing = grouped.get(card.oracle_id);

    if (existing) {
      existing.quantity_total += inventoryRow.quantity;
      if (inventoryRow.binder_type === "binder") {
        existing.quantity_in_binders += inventoryRow.quantity;
      }
      if (inventoryRow.binder_type === "deck") {
        existing.quantity_in_decks += inventoryRow.quantity;
      }
      existing.inventory.push(inventoryRow);
      if (!existing.scryfall_ids.includes(scryfallId)) {
        existing.scryfall_ids.push(scryfallId);
      }
      continue;
    }

    grouped.set(card.oracle_id, {
      oracle_id: card.oracle_id,
      name: card.name,
      mana_cost: getManaCost(card),
      mana_value: card.cmc ?? 0,
      type_line: card.type_line,
      oracle_text: getOracleText(card),
      keywords: card.keywords ?? [],
      color_identity: card.color_identity ?? [],
      edhrec_rank: card.edhrec_rank ?? null,
      legalities: getLegalities(card),
      quantity_total: inventoryRow.quantity,
      quantity_in_binders: inventoryRow.binder_type === "binder" ? inventoryRow.quantity : 0,
      quantity_in_decks: inventoryRow.binder_type === "deck" ? inventoryRow.quantity : 0,
      scryfall_ids: [scryfallId],
      inventory: [inventoryRow],
      power: card.power ?? null,
      toughness: card.toughness ?? null,
      card_faces: getCardFaces(card),
    });
  }

  return {
    cards: Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name)),
    basicLandsExcluded,
  };
}

function buildSystemPrompt(): string {
  return [
    "You are classifying a single Magic: The Gathering card for deckbuilding-theme analysis.",
    "Return only structured JSON matching the provided schema.",
    "Use established MTG deckbuilding language whenever possible.",
    "Prefer the provided canonical vocabulary when it fits the card well, but if there is a real gap you may use a better MTG-native theme label.",
    "Assign exactly one primary theme unless a tie is unavoidable.",
    "Secondary themes should be sparse and justified, not exhaustive.",
    "Confidence means certainty that the label is correct, not power level.",
    "Reasoning notes must be short and evidence-based, grounded in oracle text, type line, keywords, or clearly implied gameplay role.",
    "Do not describe the card generically if a specific theme label is justified.",
    "Use tools only if you truly need them. The provided card facts should usually be sufficient.",
  ].join("\n");
}

function toClassifierPayload(card: ClassificationCard) {
  return {
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost,
    mana_value: card.mana_value,
    type_line: card.type_line,
    oracle_text: card.oracle_text,
    keywords: card.keywords,
    color_identity: card.color_identity,
    power: card.power,
    toughness: card.toughness,
    legalities: card.legalities,
    edhrec_rank: card.edhrec_rank,
    card_faces: card.card_faces,
  };
}

function buildClassificationPrompt(card: ClassificationCard, vocabulary: ThemeVocabularyState): string {
  const cardPayload = toClassifierPayload(card);

  return [
    "Classify the following single Oracle card into gameplay themes.",
    "",
    "Preferred canonical themes:",
    vocabularyPrompt(vocabulary),
    "",
    "Guidance:",
    "- choose 1 primary theme and only as many secondary themes as are genuinely justified",
    "- use role vocabulary exactly as provided by schema",
    "- if you use a new theme not in the preferred list, include a category_hint describing its parent family",
    "- keep reasoning notes under 160 characters when possible",
    "",
    "Card facts:",
    JSON.stringify(cardPayload, null, 2),
  ].join("\n");
}

function buildAuditPrompt(
  card: ClassificationCard,
  vocabulary: ThemeVocabularyState,
  previous: FinalThemeAssignment[],
  reasons: AuditReason[],
): string {
  return [
    "Review a prior MTG theme classification for a single Oracle card.",
    "",
    "Preferred canonical themes:",
    vocabularyPrompt(vocabulary),
    "",
    "Keep labels that are already good. Revise only if the prior output is overstated, under-tagged, mislabeled, or poorly calibrated.",
    "",
    `Audit reasons: ${reasons.join(", ")}`,
    "",
    "Existing classification:",
    JSON.stringify(previous, null, 2),
    "",
    "Card facts:",
    JSON.stringify(toClassifierPayload(card), null, 2),
  ].join("\n");
}

function parseClassifierResponse(raw: unknown): ClassifierResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Structured output missing object payload");
  }

  const candidate = raw as { themes?: unknown };
  if (!Array.isArray(candidate.themes) || candidate.themes.length === 0) {
    throw new Error("Structured output missing themes array");
  }

  return {
    themes: candidate.themes.map((theme) => {
      if (!theme || typeof theme !== "object") {
        throw new Error("Theme candidate is not an object");
      }
      const value = theme as Record<string, unknown>;
      return {
        primary: Boolean(value.primary),
        theme: String(value.theme ?? "").trim(),
        category_hint: typeof value.category_hint === "string" ? value.category_hint.trim() : undefined,
        role: String(value.role ?? "support"),
        strength: Number(value.strength ?? 1),
        confidence: Number(value.confidence ?? 0.5),
        reasoning_notes: String(value.reasoning_notes ?? "").trim(),
      };
    }),
  };
}

function guessCategoryFromTheme(theme: string): string {
  const normalized = normalizeLookupKey(theme);
  if (normalized.includes("lifegain") || normalized.includes("life gain")) {
    return "lifegain";
  }
  if (normalized.includes("counter") || normalized.includes("proliferate")) {
    return "counters";
  }
  if (normalized.includes("token") || normalized.includes("go-wide") || normalized.includes("go wide")) {
    return "tokens";
  }
  if (normalized.includes("sacrifice") || normalized.includes("aristocrat")) {
    return "sacrifice";
  }
  if (normalized.includes("graveyard") || normalized.includes("reanim") || normalized.includes("mill")) {
    return "graveyard";
  }
  if (normalized.includes("spell") || normalized.includes("heroic") || normalized.includes("prowess")) {
    return "spells";
  }
  if (normalized.includes("artifact") || normalized.includes("equipment")) {
    return "artifacts";
  }
  if (normalized.includes("aura") || normalized.includes("enchant")) {
    return "enchantments";
  }
  if (normalized.includes("ramp") || normalized.includes("mana") || normalized.includes("landfall")) {
    return "mana";
  }
  if (normalized.includes("tempo") || normalized.includes("control") || normalized.includes("remove") || normalized.includes("discard") || normalized.includes("draw") || normalized.includes("blink")) {
    return "interaction";
  }
  if (normalized.includes("tribal")) {
    return "tribal";
  }
  if (normalized.includes("infect") || normalized.includes("poison")) {
    return "poison";
  }
  return "misc";
}

function normalizeTheme(
  vocabulary: ThemeVocabularyState,
  theme: string,
  categoryHint?: string,
): { entry: ThemeVocabularyEntry; proposed: boolean } {
  const displayTheme = toDisplayTheme(theme);
  const lookupKey = normalizeLookupKey(displayTheme);
  const canonicalFromSynonym = THEME_SYNONYMS.get(lookupKey);
  const existing = vocabulary.entries.get(normalizeLookupKey(canonicalFromSynonym ?? displayTheme));

  if (existing) {
    return { entry: existing, proposed: false };
  }

  const category = toDisplayCategory(categoryHint || guessCategoryFromTheme(displayTheme));
  const entry = {
    theme: displayTheme,
    category,
  };
  vocabulary.entries.set(normalizeLookupKey(displayTheme), entry);
  return { entry, proposed: true };
}

function normalizeAssignments(vocabulary: ThemeVocabularyState, response: ClassifierResponse): {
  themes: FinalThemeAssignment[];
  proposedThemes: string[];
} {
  const proposedThemes: string[] = [];
  const assignments = response.themes.map((candidate) => {
    if (!candidate.theme) {
      throw new Error("Theme label cannot be empty");
    }

    const { entry, proposed } = normalizeTheme(vocabulary, candidate.theme, candidate.category_hint);
    if (proposed) {
      proposedThemes.push(entry.theme);
    }

    return {
      primary: candidate.primary,
      category: entry.category,
      theme: entry.theme,
      role: normalizeRole(candidate.role),
      strength: clampStrength(candidate.strength),
      confidence: clampConfidence(candidate.confidence),
      reasoning_notes: candidate.reasoning_notes || "Theme inferred from card text and gameplay role.",
    } satisfies FinalThemeAssignment;
  });

  assignments.sort((left, right) => {
    if (Number(right.primary) !== Number(left.primary)) {
      return Number(right.primary) - Number(left.primary);
    }
    if (right.strength !== left.strength) {
      return right.strength - left.strength;
    }
    return right.confidence - left.confidence;
  });

  let primaryAssigned = false;
  const deduped = new Map<string, FinalThemeAssignment>();

  for (const assignment of assignments) {
    const key = `${assignment.category}::${assignment.theme}`;
    const existing = deduped.get(key);
    if (!existing || assignment.strength > existing.strength || assignment.confidence > existing.confidence) {
      deduped.set(key, {
        ...assignment,
        primary: false,
      });
    }
  }

  const finalAssignments = Array.from(deduped.values()).sort((left, right) => {
    if (right.strength !== left.strength) {
      return right.strength - left.strength;
    }
    return right.confidence - left.confidence;
  });

  for (const assignment of finalAssignments) {
    if (!primaryAssigned) {
      assignment.primary = true;
      primaryAssigned = true;
    }
  }

  if (finalAssignments.length === 0) {
    throw new Error("No normalized themes produced");
  }

  return {
    themes: finalAssignments,
    proposedThemes,
  };
}

function getAuditReasons(card: ClassificationCard, themes: FinalThemeAssignment[], proposedThemes: string[]): AuditReason[] {
  const reasons: AuditReason[] = [];

  if (themes.some((theme) => theme.confidence < LOW_CONFIDENCE_THRESHOLD)) {
    reasons.push("low_confidence");
  }
  if (themes.length > BROAD_THEME_THRESHOLD) {
    reasons.push("broad_tagging");
  }
  const primary = themes.find((theme) => theme.primary) ?? themes[0];
  if (card.edhrec_rank !== null && card.edhrec_rank <= 10000 && primary?.strength === 3) {
    reasons.push("high_impact");
  }
  if (proposedThemes.length > 0) {
    reasons.push("proposed_theme");
  }

  return reasons;
}

async function classifyCard(
  client: Awaited<ReturnType<typeof createOpencode>>["client"],
  card: ClassificationCard,
  vocabulary: ThemeVocabularyState,
  mode: "first_pass" | "audit",
  previous?: FinalThemeAssignment[],
  reasons: AuditReason[] = [],
): Promise<{ themes: FinalThemeAssignment[]; proposedThemes: string[]; auditReasons: AuditReason[] }> {
  const sessionResponse = await client.session.create({
    directory: ROOT,
    title: `${mode}:${card.name}`,
  });

  if (sessionResponse.error || !sessionResponse.data) {
    throw new Error(`Failed to create session: ${JSON.stringify(sessionResponse.error)}`);
  }

  const session = sessionResponse.data;

  const prompt =
    mode === "audit"
      ? buildAuditPrompt(card, vocabulary, previous ?? [], reasons)
      : buildClassificationPrompt(card, vocabulary);

  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await client.session.prompt({
        sessionID: session.id,
        directory: ROOT,
        model: {
          providerID: MODEL.providerID,
          modelID: MODEL.modelID,
        },
        variant: MODEL.variant,
        format: {
          type: "json_schema",
          schema: CLASSIFIER_SCHEMA,
          retryCount: 1,
        },
        system: buildSystemPrompt(),
        parts: [
          {
            type: "text",
            text: prompt,
          },
        ],
      });

      if (response.error || !response.data) {
        throw new Error(`Prompt failed: ${JSON.stringify(response.error)}`);
      }

      if (response.data.info.error) {
        throw new Error(JSON.stringify(response.data.info.error));
      }

      const parsed = parseClassifierResponse(response.data.info.structured);
      const normalized = normalizeAssignments(vocabulary, parsed);
      return {
        themes: normalized.themes,
        proposedThemes: normalized.proposedThemes,
        auditReasons: getAuditReasons(card, normalized.themes, normalized.proposedThemes),
      };
    } catch (error) {
      lastError = error;
      await Bun.sleep(350 * attempt);
    }
  }

  throw lastError;
}

async function loadExistingVocabularyFromCheckpoints(vocabulary: ThemeVocabularyState, cards: ClassificationCard[]) {
  for (const card of cards) {
    const checkpoint = await readCheckpoint(card.oracle_id);
    if (!checkpoint) {
      continue;
    }
    if (checkpoint.final) {
      extendVocabularyFromThemes(vocabulary, checkpoint.final.themes);
      continue;
    }
    if (checkpoint.first_pass) {
      extendVocabularyFromThemes(vocabulary, checkpoint.first_pass.themes);
    }
  }
}

function buildDataset(
  cards: ClassificationCard[],
  checkpoints: Map<string, Checkpoint>,
  basicLandsExcluded: number,
): PilotDataset {
  const exportedCards: PilotCard[] = [];
  let auditedCards = 0;
  let quarantinedCards = 0;

  for (const card of cards) {
    const checkpoint = checkpoints.get(card.oracle_id);
    if (!checkpoint) {
      continue;
    }

    if (checkpoint.quarantine) {
      quarantinedCards += 1;
      continue;
    }

    const finalThemes = checkpoint.final?.themes ?? checkpoint.first_pass?.themes;
    if (!finalThemes || finalThemes.length === 0) {
      continue;
    }

    if (checkpoint.final?.audited) {
      auditedCards += 1;
    }

    exportedCards.push({
      oracle_id: card.oracle_id,
      name: card.name,
      mana_cost: card.mana_cost,
      mana_value: card.mana_value,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      keywords: card.keywords,
      color_identity: card.color_identity,
      edhrec_rank: card.edhrec_rank,
      legalities: card.legalities,
      quantity_total: card.quantity_total,
      quantity_in_binders: card.quantity_in_binders,
      quantity_in_decks: card.quantity_in_decks,
      scryfall_ids: card.scryfall_ids,
      inventory: card.inventory,
      themes: finalThemes,
    });
  }

  const snapshotVocabulary = buildVocabularyState();
  for (const card of exportedCards) {
    extendVocabularyFromThemes(snapshotVocabulary, card.themes);
  }

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source: {
      collection_csv: join(ROOT, "ManaBox_Collection.csv"),
      pilot_sample_csv: INPUT_PATH,
      ownership_unit: "print rows from ManaBox",
      gameplay_identity_unit: "oracle card",
      excluded_cards: {
        basic_lands: basicLandsExcluded,
      },
    },
    classification_policy: {
      model: `${MODEL.providerID}/${MODEL.modelID}`,
      variant: MODEL.variant,
      primary_theme_required: true,
      secondary_theme_guideline: "Assign secondary themes only when they are genuinely justified; many are allowed but sparse tagging is preferred.",
      confidence_definition: "certainty that the label is correct, not card power level",
      audit_thresholds: {
        confidence_below: LOW_CONFIDENCE_THRESHOLD,
        theme_count_above: BROAD_THEME_THRESHOLD,
      },
      role_vocabulary: ROLE_VOCABULARY,
      strength_scale: {
        "1": "incidental / weak support",
        "2": "meaningful support",
        "3": "core / pillar / strong anchor",
      },
    },
    run_summary: {
      oracle_cards_total: cards.length,
      oracle_cards_classified: exportedCards.length,
      oracle_cards_quarantined: quarantinedCards,
      cards_audited: auditedCards,
    },
    theme_vocabulary: {
      version: snapshotVocabulary.version,
      themes: getVocabularyEntries(snapshotVocabulary),
    },
    cards: exportedCards,
  };
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(CHECKPOINT_DIR, { recursive: true });

  const csv = await readFile(INPUT_PATH, "utf8");
  const rows = parseCsv(csv);

  const scryfallIds = Array.from(new Set(rows.map((row) => row["Scryfall ID"]))).filter(Boolean);
  const cardsById = new Map<string, ScryfallCard>();

  for (const scryfallId of scryfallIds) {
    const card = await fetchScryfallCard(scryfallId);
    cardsById.set(scryfallId, card);
  }

  const built = buildCards(rows, cardsById);
  const cards = PILOT_LIMIT === null ? built.cards : built.cards.slice(0, PILOT_LIMIT);
  const basicLandsExcluded = built.basicLandsExcluded;
  const vocabulary = buildVocabularyState();
  await loadExistingVocabularyFromCheckpoints(vocabulary, cards);

  const { client, server } = await createOpencode();

  try {
    const checkpoints = new Map<string, Checkpoint>();

    for (const card of cards) {
      const existing = (await readCheckpoint(card.oracle_id)) ?? {
        oracle_id: card.oracle_id,
        name: card.name,
      } satisfies Checkpoint;

      checkpoints.set(card.oracle_id, existing);
    }

    const firstPassPending = cards.filter((card) => !checkpoints.get(card.oracle_id)?.first_pass);

    for (const group of chunkArray(firstPassPending, CONCURRENCY)) {
      await Promise.all(
        group.map(async (card) => {
          const checkpoint = checkpoints.get(card.oracle_id);
          if (!checkpoint) {
            return;
          }

          console.log(`First pass: ${card.name}`);
          try {
            const result = await classifyCard(client, card, vocabulary, "first_pass");
            delete checkpoint.quarantine;
            checkpoint.first_pass = {
              themes: result.themes,
              audit_reasons: result.auditReasons,
              proposed_themes: result.proposedThemes,
            };
            if (!result.auditReasons.length) {
              checkpoint.final = {
                themes: result.themes,
                audit_reasons: result.auditReasons,
                proposed_themes: result.proposedThemes,
                audited: false,
              };
            }
            extendVocabularyFromThemes(vocabulary, result.themes);
          } catch (error) {
            checkpoint.quarantine = {
              stage: "first_pass",
              error: error instanceof Error ? error.message : String(error),
            };
          }
          await writeCheckpoint(checkpoint);
        }),
      );
    }

    const auditPending = cards.filter((card) => {
      const checkpoint = checkpoints.get(card.oracle_id);
      return Boolean(
        checkpoint?.first_pass && !checkpoint.final?.audited && checkpoint.first_pass.audit_reasons.length,
      );
    });

    if (SKIP_REMAINING_AUDIT) {
      console.log("Skipping remaining audit; generating dataset from available first-pass and final checkpoints.");
    } else {
      for (const group of chunkArray(auditPending, CONCURRENCY)) {
        await Promise.all(
          group.map(async (card) => {
            const checkpoint = checkpoints.get(card.oracle_id);
            if (!checkpoint?.first_pass) {
              return;
            }

            console.log(`Audit: ${card.name}`);
            try {
              const result = await classifyCard(
                client,
                card,
                vocabulary,
                "audit",
                checkpoint.first_pass.themes,
                checkpoint.first_pass.audit_reasons,
              );
              delete checkpoint.quarantine;
              checkpoint.final = {
                themes: result.themes,
                audit_reasons: result.auditReasons,
                proposed_themes: result.proposedThemes,
                audited: true,
              };
              extendVocabularyFromThemes(vocabulary, result.themes);
            } catch (error) {
              checkpoint.quarantine = {
                stage: "audit",
                error: error instanceof Error ? error.message : String(error),
              };
            }
            await writeCheckpoint(checkpoint);
          }),
        );
      }
    }

    const dataset = buildDataset(cards, checkpoints, basicLandsExcluded);
    await writeFile(OUTPUT_PATH, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

    console.log(`Wrote ${dataset.cards.length} pilot cards to ${OUTPUT_PATH}`);
    console.log(`Vocabulary size: ${dataset.theme_vocabulary.themes.length}`);
    console.log(`Quarantined cards: ${dataset.run_summary.oracle_cards_quarantined}`);
  } finally {
    server.close();
  }
}

await main();
