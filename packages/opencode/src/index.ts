import { createImportFoundationServices } from "@mtg-agent/core";
import { resolveDatabasePath } from "@mtg-agent/sqlite";

export function createLocalImportFoundation() {
  return {
    databasePath: resolveDatabasePath(),
    services: createImportFoundationServices({
      now: () => new Date(),
    }),
  };
}
