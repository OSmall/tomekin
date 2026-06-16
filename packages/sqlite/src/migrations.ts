import {mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {migrate} from "drizzle-orm/bun-sqlite/migrator";

import {closeDatabase, openDatabase, resolveDatabasePath} from "./database";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export type SqliteMigrationIo = {
    readonly stdout: { write(message: string): void };
};

export function applySqliteMigrations(
    dbPath = resolveDatabasePath(),
    io?: SqliteMigrationIo,
): void {
    io?.stdout.write(`Target database: ${dbPath}\n`);
    mkdirSync(dirname(dbPath), {recursive: true});
    const db = openDatabase(dbPath);
    try {
        migrate(db, {migrationsFolder});
    } finally {
        closeDatabase(db);
    }
    io?.stdout.write("SQLite migrations applied successfully.\n");
}
