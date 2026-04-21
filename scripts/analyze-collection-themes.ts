import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

type Role = "payoff" | "enabler" | "engine" | "interaction" | "support" | "finisher" | "ramp" | "draw";

type ThemeAssignment = {
  primary: boolean;
  category: string;
  theme: string;
  role: Role;
  strength: 1 | 2 | 3;
  confidence: number;
  reasoning_notes: string;
};

type CardRecord = {
  oracle_id: string;
  name: string;
  type_line: string;
  color_identity: string[];
  edhrec_rank: number;
  quantity_total: number;
  quantity_in_binders: number;
  quantity_in_decks: number;
  themes: ThemeAssignment[];
};

type Dataset = {
  source: {
    collection_csv: string;
    ownership_unit: string;
    gameplay_identity_unit: string;
    excluded_cards: {
      basic_lands: number;
    };
  };
  run_summary: {
    oracle_cards_total: number;
    oracle_cards_classified: number;
    oracle_cards_quarantined: number;
    cards_audited: number;
  };
  theme_vocabulary: {
    themes: Array<{
      theme: string;
      category: string;
    }>;
  };
  cards: CardRecord[];
};

type AssignmentMetric = {
  card: CardRecord;
  theme: string;
  category: string;
  role: Role;
  primary: boolean;
  exactColorKey: string;
  weightedAll: number;
  weightedBinder: number;
};

type ThemeAggregate = {
  theme: string;
  category: string;
  weightedAll: number;
  weightedBinder: number;
  distinctCards: number;
  totalCopies: number;
  binderCopies: number;
  deckCopies: number;
  primaryWeighted: number;
  roleWeights: Map<Role, number>;
  deckShellWeights: Map<string, number>;
  cards: AssignmentMetric[];
};

type PairCardMetric = {
  card: CardRecord;
  overlapAll: number;
  overlapBinder: number;
  unionAll: number;
};

type PairAggregate = {
  themeA: string;
  themeB: string;
  overlapAll: number;
  overlapBinder: number;
  unionAll: number;
  distinctCards: number;
  totalCopies: number;
  binderCopies: number;
  overlapDeckShellWeights: Map<string, number>;
  cards: PairCardMetric[];
};

type ThemeResult = ThemeAggregate & {
  primaryShare: number;
  availability: number;
  roleBalance: number;
  bestShell: string;
  bestShellName: string;
  bestShellSupport: number;
  colorCohesion: number;
  overallScore: number;
  binderReadyScore: number;
  representativeCards: string[];
};

type PairResult = PairAggregate & {
  combinedAll: number;
  combinedBinder: number;
  unionDistinctCards: number;
  unionCopies: number;
  availability: number;
  overlapShare: number;
  bestShell: string;
  bestShellName: string;
  bestShellSupport: number;
  colorCohesion: number;
  shellScore: number;
  representativeCards: string[];
};

const ROOT = process.cwd();
const DATASET_PATH = join(ROOT, "data", "collection_theme_dataset.json");
const REPORT_PATH = join(ROOT, "data", "collection_theme_analysis_report.md");
const COLORS = ["W", "U", "B", "R", "G"] as const;
const SHELL_SIZE_PENALTY: Record<number, number> = {
  0: 0.85,
  1: 1,
  2: 0.95,
  3: 0.88,
};

const dataset = (await readJson(DATASET_PATH)) as Dataset;
const deckShellKeys = buildDeckShellKeys();
const maxRank = Math.max(...dataset.cards.map((card) => card.edhrec_rank || 0));

const themeAggregates = new Map<string, ThemeAggregate>();
const pairAggregates = new Map<string, PairAggregate>();

for (const card of dataset.cards) {
  const exactColorKey = toColorKey(card.color_identity);
  const assignmentMetrics: AssignmentMetric[] = [];

  for (const assignment of card.themes) {
    const baseContribution =
      powerScore(card.edhrec_rank, maxRank) *
      (assignment.strength / 3) *
      assignment.confidence *
      (assignment.primary ? 1 : 0.7);
    const weightedAll = baseContribution * Math.sqrt(card.quantity_total);
    const weightedBinder = baseContribution * Math.sqrt(card.quantity_in_binders);

    const metric: AssignmentMetric = {
      card,
      theme: assignment.theme,
      category: assignment.category,
      role: assignment.role,
      primary: assignment.primary,
      exactColorKey,
      weightedAll,
      weightedBinder,
    };

    assignmentMetrics.push(metric);

    const aggregate = getOrCreateThemeAggregate(themeAggregates, assignment.theme, assignment.category);
    aggregate.weightedAll += weightedAll;
    aggregate.weightedBinder += weightedBinder;
    aggregate.distinctCards += 1;
    aggregate.totalCopies += card.quantity_total;
    aggregate.binderCopies += card.quantity_in_binders;
    aggregate.deckCopies += card.quantity_in_decks;
    aggregate.primaryWeighted += assignment.primary ? weightedAll : 0;
    aggregate.cards.push(metric);
    aggregate.roleWeights.set(assignment.role, (aggregate.roleWeights.get(assignment.role) ?? 0) + weightedAll);

    for (const shellKey of deckShellKeys) {
      if (isSubsetOfShell(card.color_identity, shellKey)) {
        aggregate.deckShellWeights.set(shellKey, (aggregate.deckShellWeights.get(shellKey) ?? 0) + weightedAll);
      }
    }
  }

  assignmentMetrics.sort((left, right) => left.theme.localeCompare(right.theme));

  for (let index = 0; index < assignmentMetrics.length; index += 1) {
    for (let inner = index + 1; inner < assignmentMetrics.length; inner += 1) {
      const left = assignmentMetrics[index];
      const right = assignmentMetrics[inner];
      const pairKey = `${left.theme}|||${right.theme}`;
      const pairAggregate = getOrCreatePairAggregate(pairAggregates, left.theme, right.theme);
      const overlapAll = Math.min(left.weightedAll, right.weightedAll);
      const overlapBinder = Math.min(left.weightedBinder, right.weightedBinder);
      const unionAll = Math.max(left.weightedAll, right.weightedAll);

      pairAggregate.overlapAll += overlapAll;
      pairAggregate.overlapBinder += overlapBinder;
      pairAggregate.unionAll += unionAll;
      pairAggregate.distinctCards += 1;
      pairAggregate.totalCopies += card.quantity_total;
      pairAggregate.binderCopies += card.quantity_in_binders;
      pairAggregate.cards.push({
        card,
        overlapAll,
        overlapBinder,
        unionAll,
      });

      for (const shellKey of deckShellKeys) {
        if (isSubsetOfShell(card.color_identity, shellKey)) {
          pairAggregate.overlapDeckShellWeights.set(
            shellKey,
            (pairAggregate.overlapDeckShellWeights.get(shellKey) ?? 0) + overlapAll,
          );
        }
      }

      pairAggregates.set(pairKey, pairAggregate);
    }
  }
}

const themeResults = Array.from(themeAggregates.values()).map((aggregate) => toThemeResult(aggregate));
applyThemeScoring(themeResults);
themeResults.sort((left, right) => right.overallScore - left.overallScore || right.weightedAll - left.weightedAll);

const themeByName = new Map(themeResults.map((result) => [result.theme, result]));
const pairResults = Array.from(pairAggregates.values())
  .map((aggregate) => toPairResult(aggregate, themeByName))
  .filter((pair): pair is PairResult => pair !== null);
applyPairScoring(pairResults);
pairResults.sort((left, right) => right.shellScore - left.shellScore || right.overlapAll - left.overlapAll);

const report = renderReport(dataset, themeResults, pairResults);
await mkdir(dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, report, "utf8");

console.log(`Wrote ${REPORT_PATH}`);
console.log(`Themes scored: ${themeResults.length}`);
console.log(`2-theme shells scored: ${pairResults.length}`);
console.log(`Top theme: ${themeResults[0]?.theme} (${themeResults[0]?.overallScore.toFixed(1)})`);

function getOrCreateThemeAggregate(
  aggregates: Map<string, ThemeAggregate>,
  theme: string,
  category: string,
): ThemeAggregate {
  const existing = aggregates.get(theme);
  if (existing) {
    return existing;
  }

  const created: ThemeAggregate = {
    theme,
    category,
    weightedAll: 0,
    weightedBinder: 0,
    distinctCards: 0,
    totalCopies: 0,
    binderCopies: 0,
    deckCopies: 0,
    primaryWeighted: 0,
    roleWeights: new Map(),
    deckShellWeights: new Map(),
    cards: [],
  };
  aggregates.set(theme, created);
  return created;
}

function getOrCreatePairAggregate(
  aggregates: Map<string, PairAggregate>,
  themeA: string,
  themeB: string,
): PairAggregate {
  const pairKey = `${themeA}|||${themeB}`;
  const existing = aggregates.get(pairKey);
  if (existing) {
    return existing;
  }

  const created: PairAggregate = {
    themeA,
    themeB,
    overlapAll: 0,
    overlapBinder: 0,
    unionAll: 0,
    distinctCards: 0,
    totalCopies: 0,
    binderCopies: 0,
    overlapDeckShellWeights: new Map(),
    cards: [],
  };
  aggregates.set(pairKey, created);
  return created;
}

function toThemeResult(aggregate: ThemeAggregate): ThemeResult {
  const primaryShare = safeRatio(aggregate.primaryWeighted, aggregate.weightedAll);
  const availability = safeRatio(aggregate.binderCopies, aggregate.totalCopies);
  const roleBalance = entropyScore(Array.from(aggregate.roleWeights.values()));
  const bestShell = bestShellForWeights(aggregate.deckShellWeights);
  const bestShellSupport = aggregate.deckShellWeights.get(bestShell) ?? 0;
  const colorCohesion = safeRatio(bestShellSupport * shellPenalty(bestShell), aggregate.weightedAll);
  const representativeCards = aggregate.cards
    .slice()
    .sort((left, right) => right.weightedAll - left.weightedAll)
    .slice(0, 3)
    .map((metric) => metric.card.name);

  return {
    ...aggregate,
    primaryShare,
    availability,
    roleBalance,
    bestShell,
    bestShellName: colorShellName(bestShell),
    bestShellSupport,
    colorCohesion,
    overallScore: 0,
    binderReadyScore: 0,
    representativeCards,
  };
}

function applyThemeScoring(themes: ThemeResult[]) {
  const overallNormalizer = makeNormalizer(themes.map((theme) => theme.weightedAll));
  const binderNormalizer = makeNormalizer(themes.map((theme) => theme.weightedBinder));
  const breadthNormalizer = makeNormalizer(themes.map((theme) => theme.distinctCards));

  for (const theme of themes) {
    theme.overallScore =
      100 *
      (0.34 * overallNormalizer(theme.weightedAll) +
        0.18 * breadthNormalizer(theme.distinctCards) +
        0.16 * binderNormalizer(theme.weightedBinder) +
        0.1 * theme.availability +
        0.1 * theme.primaryShare +
        0.07 * theme.roleBalance +
        0.05 * theme.colorCohesion);

    theme.binderReadyScore =
      100 *
      (0.37 * binderNormalizer(theme.weightedBinder) +
        0.2 * theme.availability +
        0.18 * breadthNormalizer(theme.distinctCards) +
        0.12 * theme.primaryShare +
        0.08 * theme.roleBalance +
        0.05 * theme.colorCohesion);
  }
}

function toPairResult(aggregate: PairAggregate, themeByName: Map<string, ThemeResult>): PairResult | null {
  const themeA = themeByName.get(aggregate.themeA);
  const themeB = themeByName.get(aggregate.themeB);
  if (!themeA || !themeB) {
    return null;
  }

  const combinedAll = themeA.weightedAll + themeB.weightedAll - aggregate.overlapAll;
  const combinedBinder = themeA.weightedBinder + themeB.weightedBinder - aggregate.overlapBinder;
  const unionDistinctCards = themeA.distinctCards + themeB.distinctCards - aggregate.distinctCards;
  const unionCopies = themeA.totalCopies + themeB.totalCopies - aggregate.totalCopies;
  const availability = safeRatio(combinedBinder, combinedAll);
  const overlapShare = safeRatio(aggregate.overlapAll, combinedAll);

  let bestShell = deckShellKeys[0];
  let bestShellSupport = 0;
  let bestAdjustedSupport = 0;

  for (const shellKey of deckShellKeys) {
    const support =
      (themeA.deckShellWeights.get(shellKey) ?? 0) +
      (themeB.deckShellWeights.get(shellKey) ?? 0) -
      (aggregate.overlapDeckShellWeights.get(shellKey) ?? 0);
    const adjusted = support * shellPenalty(shellKey);
    if (adjusted > bestAdjustedSupport) {
      bestAdjustedSupport = adjusted;
      bestShellSupport = support;
      bestShell = shellKey;
    }
  }

  const colorCohesion = safeRatio(bestAdjustedSupport, combinedAll);
  const representativeCards = aggregate.cards
    .slice()
    .sort((left, right) => right.overlapAll - left.overlapAll)
    .slice(0, 4)
    .map((metric) => metric.card.name);

  return {
    ...aggregate,
    combinedAll,
    combinedBinder,
    unionDistinctCards,
    unionCopies,
    availability,
    overlapShare,
    bestShell,
    bestShellName: colorShellName(bestShell),
    bestShellSupport,
    colorCohesion,
    shellScore: 0,
    representativeCards,
  };
}

function applyPairScoring(pairs: PairResult[]) {
  const combinedNormalizer = makeNormalizer(pairs.map((pair) => pair.combinedAll));
  const overlapNormalizer = makeNormalizer(pairs.map((pair) => pair.overlapAll));
  const distinctNormalizer = makeNormalizer(pairs.map((pair) => pair.distinctCards));

  for (const pair of pairs) {
    pair.shellScore =
      100 *
      (0.36 * combinedNormalizer(pair.combinedAll) +
        0.28 * overlapNormalizer(pair.overlapAll) +
        0.14 * distinctNormalizer(pair.distinctCards) +
        0.1 * pair.availability +
        0.07 * pair.colorCohesion +
        0.05 * pair.overlapShare);
  }
}

function renderReport(dataset: Dataset, themes: ThemeResult[], pairs: PairResult[]) {
  const topThemes = themes.slice(0, 12);
  const fullThemeTable = themes;
  const shellCandidates = pairs.filter((pair) => pair.distinctCards >= 2 && pair.overlapAll >= 0.2);
  const topShells = shellCandidates.slice(0, 15);
  const nicheThemes = themes
    .filter((theme) => theme.distinctCards <= 8 && theme.totalCopies >= 3)
    .slice()
    .sort((left, right) => right.overallScore - left.overallScore)
    .slice(0, 12);
  const inventoryPressure = themes
    .filter((theme) => theme.deckCopies > 0)
    .slice()
    .sort((left, right) => inventoryPressureScore(right) - inventoryPressureScore(left))
    .slice(0, 12);

  const colorShellRows = buildColorShellSection(themes, topShells);

  const methodology = [
    `- Source dataset: \`${relativeToRoot(DATASET_PATH)}\` (${dataset.run_summary.oracle_cards_total} classified Oracle cards, ${dataset.run_summary.oracle_cards_quarantined} quarantined, ${dataset.source.excluded_cards.basic_lands} basic lands excluded from tagging).`,
    `- Cards are already deduped to Oracle gameplay identity; quantities remain attached separately via \`quantity_total\`, \`quantity_in_binders\`, and \`quantity_in_decks\`.`,
    `- Per-theme card contribution uses \`power_score * (strength / 3) * confidence * primary_weight\`, with \`primary_weight = 1.0\` and secondary themes discounted to \`0.7\`.`,
    `- \`power_score\` is a log-scaled inversion of \`edhrec_rank\`, normalized against the collection's worst rank (${maxRank}), then clamped to keep fringe cards from going to zero.`,
    `- Quantity contributes sublinearly via \`sqrt(quantity)\` so four copies matter more than one copy without overwhelming distinct-card breadth.`,
    `- Single-theme buildability blends weighted quality, breadth, binder-ready mass, availability ratio, primary-theme concentration, role balance, and best 1-3 color shell cohesion.`,
    `- 2-theme shell scores combine total shared support, true same-card overlap, overlap breadth, binder availability, and best common 1-3 color shell.`,
    `- EDHREC rank is treated as a heuristic proxy for card quality/playability, not a format gate or absolute truth.`,
  ].join("\n");

  const lines: string[] = [];
  lines.push("# Collection Theme Analysis Report");
  lines.push("");
  lines.push(`Generated from \`${relativeToRoot(DATASET_PATH)}\`.`);
  lines.push("");
  lines.push("## Methodology");
  lines.push(methodology);
  lines.push("");
  lines.push("## Strongest Single Themes");
  lines.push("");
  lines.push("These are the best overall deck seeds when quality, breadth, copies, binder availability, and color cohesion are considered together.");
  lines.push("");

  for (const [index, theme] of topThemes.entries()) {
    lines.push(`### ${index + 1}. ${theme.theme}`);
    lines.push(`- Category: ${theme.category}`);
    lines.push(`- Overall buildability: ${fmt(theme.overallScore)} | Binder-ready: ${fmt(theme.binderReadyScore)}`);
    lines.push(`- Depth: ${theme.distinctCards} Oracle cards | ${theme.totalCopies} copies owned | ${theme.binderCopies} in binders | ${theme.deckCopies} in decks`);
    lines.push(`- Structure: ${pct(theme.primaryShare)} primary concentration | ${pct(theme.availability)} binder availability | ${pct(theme.colorCohesion)} color cohesion via ${theme.bestShellName}`);
    lines.push(`- Representative cards: ${theme.representativeCards.join(", ")}`);
    lines.push("");
  }

  lines.push("### Full Theme Table");
  lines.push("");
  lines.push("| Rank | Theme | Category | Score | Binder | Cards | Copies | Binder Copies | Deck Copies | Primary | Best Shell | Representative Cards |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
  for (const [index, theme] of fullThemeTable.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeMd(theme.theme)} | ${escapeMd(theme.category)} | ${fmt(theme.overallScore)} | ${fmt(theme.binderReadyScore)} | ${theme.distinctCards} | ${theme.totalCopies} | ${theme.binderCopies} | ${theme.deckCopies} | ${pct(theme.primaryShare)} | ${escapeMd(theme.bestShellName)} | ${escapeMd(theme.representativeCards.join(", "))} |`,
    );
  }
  lines.push("");

  lines.push("## Strongest 2-Theme Shells");
  lines.push("");
  lines.push("These shells are ranked from actual same-card theme overlap plus the size and cohesion of the combined card pool.");
  lines.push("");
  lines.push("| Rank | Shell | Score | Best Colors | Overlap Cards | Union Cards | Overlap Share | Binder Availability | Representative Cards |");
  lines.push("| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |");
  for (const [index, pair] of topShells.entries()) {
    lines.push(
      `| ${index + 1} | ${escapeMd(`${pair.themeA} + ${pair.themeB}`)} | ${fmt(pair.shellScore)} | ${escapeMd(pair.bestShellName)} | ${pair.distinctCards} | ${pair.unionDistinctCards} | ${pct(pair.overlapShare)} | ${pct(pair.availability)} | ${escapeMd(pair.representativeCards.join(", "))} |`,
    );
  }
  lines.push("");

  lines.push("## Strongest Color-Cohesive Shells");
  lines.push("");
  lines.push("Focused on shells that show the clearest internal identity rather than broad, generic interaction spillover.");
  lines.push("");
  lines.push("| Color Shell | Top Themes | Best 2-Theme Shell | Notes |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of colorShellRows) {
    lines.push(
      `| ${escapeMd(row.shellName)} | ${escapeMd(row.topThemes)} | ${escapeMd(row.bestPair)} | ${escapeMd(row.note)} |`,
    );
  }
  lines.push("");

  lines.push("## Niche Themes");
  lines.push("");
  lines.push("Low-breadth themes that still look like real archetype seeds instead of random one-offs.");
  lines.push("");
  lines.push("| Theme | Score | Cards | Copies | Best Shell | Representative Cards |");
  lines.push("| --- | ---: | ---: | ---: | --- | --- |");
  for (const theme of nicheThemes) {
    lines.push(
      `| ${escapeMd(theme.theme)} | ${fmt(theme.overallScore)} | ${theme.distinctCards} | ${theme.totalCopies} | ${escapeMd(theme.bestShellName)} | ${escapeMd(theme.representativeCards.join(", "))} |`,
    );
  }
  lines.push("");

  lines.push("## Inventory Pressure");
  lines.push("");
  lines.push("These themes still score well overall, but a material share of their strength is currently tied up in decks instead of binders.");
  lines.push("");
  lines.push("| Theme | Pressure | Overall Score | Binder Availability | Deck Copies | Representative Cards |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- |");
  for (const theme of inventoryPressure) {
    lines.push(
      `| ${escapeMd(theme.theme)} | ${fmt(inventoryPressureScore(theme))} | ${fmt(theme.overallScore)} | ${pct(theme.availability)} | ${theme.deckCopies} | ${escapeMd(theme.representativeCards.join(", "))} |`,
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function buildColorShellSection(themes: ThemeResult[], pairs: PairResult[]) {
  return deckShellKeys
    .map((shellKey) => {
      const topThemes = themes
        .slice()
        .sort((left, right) => shellThemeSupport(right, shellKey) - shellThemeSupport(left, shellKey))
        .slice(0, 3);
      const bestPair = pairs
        .filter((pair) => pair.bestShell === shellKey)
        .slice()
        .sort((left, right) => shellPairSupport(right, shellKey) - shellPairSupport(left, shellKey))[0];

      if (topThemes.length === 0) {
        return null;
      }

      const dominantSupport = Math.max(shellThemeSupport(topThemes[0], shellKey), bestPair ? shellPairSupport(bestPair, shellKey) : 0);
      if (dominantSupport < 8) {
        return null;
      }

      return {
        shellKey,
        shellName: colorShellName(shellKey),
        dominantSupport,
        topThemes: topThemes.map((theme) => `${theme.theme} (${fmt(shellThemeSupport(theme, shellKey))})`).join(", "),
        bestPair: bestPair ? `${bestPair.themeA} + ${bestPair.themeB} (${fmt(shellPairSupport(bestPair, shellKey))})` : "no standout pair",
        note: bestPair
          ? `${bestPair.unionDistinctCards} cards in the combined pool, ${pct(bestPair.availability)} binder availability, ${bestPair.distinctCards} direct overlap cards.`
          : `${topThemes[0].distinctCards} cards contribute to the lead theme with ${pct(topThemes[0].availability)} binder availability.`,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.dominantSupport - left.dominantSupport)
    .slice(0, 12);
}

function shellThemeSupport(theme: ThemeResult, shellKey: string) {
  return (theme.deckShellWeights.get(shellKey) ?? 0) * shellPenalty(shellKey);
}

function shellPairSupport(pair: PairResult, shellKey: string) {
  return pair.bestShell === shellKey ? pair.bestShellSupport * shellPenalty(shellKey) : 0;
}

function inventoryPressureScore(theme: ThemeResult) {
  return theme.overallScore * (1 - theme.availability);
}

function buildDeckShellKeys() {
  const keys: string[] = [];
  for (let size = 1; size <= 3; size += 1) {
    combineColors([], 0, size, keys);
  }
  return keys;
}

function combineColors(prefix: string[], start: number, size: number, output: string[]) {
  if (prefix.length === size) {
    output.push(prefix.join(""));
    return;
  }

  for (let index = start; index < COLORS.length; index += 1) {
    combineColors([...prefix, COLORS[index]], index + 1, size, output);
  }
}

function isSubsetOfShell(cardColors: string[], shellKey: string) {
  const shellSet = new Set(shellKey.split(""));
  return cardColors.every((color) => shellSet.has(color));
}

function toColorKey(colors: string[]) {
  if (colors.length === 0) {
    return "C";
  }

  return COLORS.filter((color) => colors.includes(color)).join("");
}

function colorShellName(shellKey: string) {
  const names: Record<string, string> = {
    W: "mono-white",
    U: "mono-blue",
    B: "mono-black",
    R: "mono-red",
    G: "mono-green",
    WU: "azorius",
    WB: "orzhov",
    WR: "boros",
    WG: "selesnya",
    UB: "dimir",
    UR: "izzet",
    UG: "simic",
    BR: "rakdos",
    BG: "golgari",
    RG: "gruul",
    WUB: "esper",
    WUR: "jeskai",
    WUG: "bant",
    WBR: "mardu",
    WBG: "abzan",
    WRG: "naya",
    UBR: "grixis",
    UBG: "sultai",
    URG: "temur",
    BRG: "jund",
  };

  return names[shellKey] ?? shellKey;
}

function shellPenalty(shellKey: string) {
  return SHELL_SIZE_PENALTY[shellKey.length] ?? 0.8;
}

function bestShellForWeights(weights: Map<string, number>) {
  let bestShell = deckShellKeys[0];
  let bestScore = -1;

  for (const shellKey of deckShellKeys) {
    const adjusted = (weights.get(shellKey) ?? 0) * shellPenalty(shellKey);
    if (adjusted > bestScore) {
      bestScore = adjusted;
      bestShell = shellKey;
    }
  }

  return bestShell;
}

function entropyScore(values: number[]) {
  const positive = values.filter((value) => value > 0);
  if (positive.length <= 1) {
    return 0;
  }

  const total = positive.reduce((sum, value) => sum + value, 0);
  const entropy = positive.reduce((sum, value) => {
    const probability = value / total;
    return sum - probability * Math.log(probability);
  }, 0);

  return entropy / Math.log(positive.length);
}

function makeNormalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return () => 1;
  }

  return (value: number) => (value - min) / (max - min);
}

function powerScore(rank: number, highestRank: number) {
  if (!rank || rank <= 0) {
    return 0.35;
  }

  const normalized = 1 - Math.log(rank + 1) / Math.log(highestRank + 1);
  return clamp(0.15 + normalized * 0.85, 0.15, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeRatio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function fmt(value: number) {
  return value.toFixed(1);
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function escapeMd(value: string) {
  return value.replace(/\|/g, "\\|");
}

function relativeToRoot(filePath: string) {
  return filePath.replace(`${ROOT}\\`, "").replace(/\\/g, "/");
}

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}
