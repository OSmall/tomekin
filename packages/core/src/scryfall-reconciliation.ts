import {z} from "zod";
import {ok, err, type Result} from "neverthrow";
import type {
  CardIdentityImportRecord, CardPrintingImportRecord, CardIdentityTagImportRecord,
  ScryfallBulkImportInput, ScryfallBulkDataImport, ScryfallRepositoryError,
  ScryfallBulkDataSyncPorts,
} from "./scryfall-sync";

export type ScryfallRefreshFailureReason = "migration_conflict" | "migration_cycle" | "missing_migration_evidence" |
  "discovery_budget_exhausted" | "invalid_migration_pagination" | "invalid_migration_input" | "ambiguous_identity_replacement" |
  "rate_limit_exhausted" | "migration_fetch_failed" | "snapshot_incompatible" | "referenced_deletion" | "user_data_conflict" | "concurrent_state_changed" | "source_validation_failed" | "publication_failed";
export type ScryfallRefreshDiagnostics = {
  phase: "staging" | "incoming_validation" | "migration_discovery" | "user_reference_validation" | "publication";
  reason: ScryfallRefreshFailureReason;
  referenceCounts?: Readonly<Record<string, number>>;
  exampleIds?: readonly string[];
  sources: readonly {bulkDataType: string; sourceUri: string | undefined; sourceUpdatedAt: Date | undefined}[];
};
export class ScryfallRefreshFailure extends Error {
  readonly type = "reconciliation_failed";
  constructor(readonly reason: ScryfallRefreshFailureReason, message: string,
    readonly referenceCounts?: Readonly<Record<string, number>>, readonly exampleIds?: readonly string[]) { super(message); }
}

export const CardMigrationSchema = z.object({
  object: z.literal("migration"),
  id: z.uuid(),
  performed_at: z.iso.date(),
  old_scryfall_id: z.uuid(),
  migration_strategy: z.enum(["merge", "delete"]),
  new_scryfall_id: z.uuid().nullish().transform(value => value ?? null),
}).check(ctx => {
  const record = ctx.value;
  if ((record.migration_strategy === "merge") !== (record.new_scryfall_id != null))
    ctx.issues.push({code: "custom", input: record, continue: true,
      message: "merge requires a replacement; delete must not name one"});
});
export type CardMigration = z.infer<typeof CardMigrationSchema>;
export type ScryfallReconciliationPlan = {
  printings: ReadonlyMap<string, string | null>;
  identities: ReadonlyMap<string, string | null>;
  applied: readonly CardMigration[];
};
export type ScryfallRefreshGraph = {
  removedPrintings: readonly {id: string; cardIdentityId: string}[];
  removedIdentities: readonly string[];
  incomingPrintingIdentity(id: string): string | null;
};
export type ScryfallRefreshInput = {
  identities: ScryfallBulkImportInput<CardIdentityImportRecord>;
  printings: ScryfallBulkImportInput<CardPrintingImportRecord>;
  tags: ScryfallBulkImportInput<CardIdentityTagImportRecord>;
  reconcile(graph: ScryfallRefreshGraph, cached: readonly CardMigration[], cache: (records: readonly CardMigration[]) => void): Promise<Result<ScryfallReconciliationPlan, ScryfallRefreshFailure>>;
};
export type ScryfallRefreshRepository = {
  refreshReferenceData(input: ScryfallRefreshInput): Promise<Result<readonly ScryfallBulkDataImport[], ScryfallRepositoryError>>;
};
export const scryfallMigrationDiscoveryLimits = {requests: 32, bytes: 16 * 1024 * 1024, elapsedMs: 180_000} as const;

/** Resolve only transitions required by the staged snapshot. Notes and metadata are never mapping authority. */
export async function reconcileScryfallRefresh(
  graph: ScryfallRefreshGraph, cached: readonly CardMigration[],
  cache: (records: readonly CardMigration[]) => void, ports: ScryfallBulkDataSyncPorts,
): Promise<Result<ScryfallReconciliationPlan, ScryfallRefreshFailure>> {
  try { return ok(await resolveRefresh(graph, cached, cache, ports)); }
  catch (error) {
    if (error instanceof ScryfallRefreshFailure) return err(error);
    throw error;
  }
}
async function resolveRefresh(
  graph: ScryfallRefreshGraph, cached: readonly CardMigration[],
  cache: (records: readonly CardMigration[]) => void, ports: ScryfallBulkDataSyncPorts,
): Promise<ScryfallReconciliationPlan> {
  const evidence = new Map<string, CardMigration>();
  function add(records: readonly CardMigration[]) {
    for (const record of records) {
      const previous = evidence.get(record.old_scryfall_id);
      if (previous && (previous.migration_strategy !== record.migration_strategy || previous.new_scryfall_id !== record.new_scryfall_id))
        throw new ScryfallRefreshFailure("migration_conflict", `migration_conflict: contradictory evidence for ${record.old_scryfall_id}. Retry with compatible sources.`);
      evidence.set(record.old_scryfall_id, record);
    }
  }
  add(cached);
  const applied = new Map<string, CardMigration>();
  function resolve(id: string): string | null | undefined {
    const seen = new Set<string>();
    while (true) {
      if (graph.incomingPrintingIdentity(id)) return id;
      if (seen.has(id)) throw new ScryfallRefreshFailure("migration_cycle", `migration_cycle: ${id}. Repair official evidence before retrying.`);
      seen.add(id);
      const migration = evidence.get(id);
      if (!migration) return undefined;
      applied.set(migration.id, migration);
      if (migration.migration_strategy === "delete") return null;
      id = migration.new_scryfall_id!;
    }
  }
  let next: string | undefined = "https://api.scryfall.com/migrations";
  const seenPages = new Set<string>();
  let requests = 0, bytes = 0;
  const started = ports.monotonicNow?.() ?? performance.now();
  const unresolved = () => graph.removedPrintings.filter(record => resolve(record.id) === undefined);
  while (unresolved().length > 0 && next) {
    const elapsed = (ports.monotonicNow?.() ?? performance.now()) - started;
    if (requests >= scryfallMigrationDiscoveryLimits.requests || elapsed >= scryfallMigrationDiscoveryLimits.elapsedMs)
      throw new ScryfallRefreshFailure("discovery_budget_exhausted", "discovery_budget_exhausted: incomplete reconciliation. Previous data preserved; retry with cached evidence or compatible snapshots.");
    if (!ports.listCardMigrations) throw new ScryfallRefreshFailure("missing_migration_evidence", "missing_migration_evidence: migration source unavailable. Run coordinated sync:scryfall.");
    if (seenPages.has(next) || !isScryfallMigrationPageUrl(next)) throw new ScryfallRefreshFailure("invalid_migration_pagination", "invalid_migration_pagination: retry with valid official sources.");
    seenPages.add(next);
    const page = await ports.listCardMigrations(next, {
      remainingMs: scryfallMigrationDiscoveryLimits.elapsedMs - elapsed,
      remainingBytes: scryfallMigrationDiscoveryLimits.bytes - bytes,
      remainingRequests: scryfallMigrationDiscoveryLimits.requests - requests,
    });
    if (page.isErr()) throw new ScryfallRefreshFailure(page.error.reason ?? "migration_fetch_failed", page.error.message);
    requests += page.value.requestCount ?? 1;
    bytes += page.value.responseBytes ?? new TextEncoder().encode(JSON.stringify(page.value)).byteLength;
    if (bytes > scryfallMigrationDiscoveryLimits.bytes || requests > scryfallMigrationDiscoveryLimits.requests ||
      (ports.monotonicNow?.() ?? performance.now()) - started > scryfallMigrationDiscoveryLimits.elapsedMs)
      throw new ScryfallRefreshFailure("discovery_budget_exhausted", "discovery_budget_exhausted: incomplete reconciliation. Retry using cached evidence.");
    const pageResult = z.object({data: z.array(CardMigrationSchema), has_more: z.boolean(), next_page: z.string().nullish()}).safeParse(page.value);
    if (!pageResult.success) throw new ScryfallRefreshFailure("invalid_migration_input", `invalid_migration_input: ${pageResult.error.issues.slice(0, 5).map(issue => issue.message.slice(0, 160)).join("; ")}. Retry valid official evidence.`);
    const parsed = pageResult.data;
    if (parsed.has_more && (!parsed.next_page || !isScryfallMigrationPageUrl(parsed.next_page))) throw new ScryfallRefreshFailure("invalid_migration_pagination", "invalid_migration_pagination: missing or unsafe continuation.");
    add(parsed.data);
    cache(parsed.data);
    next = parsed.has_more ? parsed.next_page ?? undefined : undefined;
  }
  const missing = unresolved();
  if (missing.length) throw new ScryfallRefreshFailure("missing_migration_evidence", `missing_migration_evidence: ${missing.length} unexplained Printing disappearances; examples: ${missing.slice(0, 5).map(row => row.id).join(", ")}. Retry with compatible snapshots or repair source data.`);
  const printings = new Map(graph.removedPrintings.map(row => [row.id, resolve(row.id)!]));
  for (const migration of applied.values()) printings.set(migration.old_scryfall_id, resolve(migration.old_scryfall_id)!);
  const identities = new Map<string, string | null>();
  for (const id of graph.removedIdentities) {
    const records = graph.removedPrintings.filter(row => row.cardIdentityId === id);
    if (!records.length) throw new ScryfallRefreshFailure("missing_migration_evidence", `missing_migration_evidence: disappearing Card Identity ${id} has no authoritative Printing transition.`);
    const targets = new Set(records.map(row => {
      const target = printings.get(row.id);
      return target ? graph.incomingPrintingIdentity(target) : null;
    }));
    if (targets.size !== 1) throw new ScryfallRefreshFailure("ambiguous_identity_replacement", `ambiguous_identity_replacement: ${id}. Repair references before retrying.`);
    identities.set(id, [...targets][0]!);
  }
  return {printings, identities, applied: [...applied.values()]};
}
export function isScryfallMigrationPageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://api.scryfall.com" && url.pathname === "/migrations" &&
      !url.username && !url.password && !url.hash && [...url.searchParams].every(([key, v]) => key === "page" && /^[1-9]\d*$/.test(v));
  } catch { return false; }
}
