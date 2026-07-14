import {mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {sql} from "drizzle-orm";
import {migrate} from "drizzle-orm/bun-sqlite/migrator";
import type {Logger} from "@tomekin/core";

import {closeDatabase, openDatabase, resolveDatabasePath} from "./database";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export type SqliteMigrationIo = {
    readonly stdout: { write(message: string): void };
};

export function applySqliteMigrations(
    dbPath = resolveDatabasePath(),
    options: { readonly log: Logger },
    io?: SqliteMigrationIo,
): void {
    io?.stdout.write(`Target database: ${dbPath}\n`);
    mkdirSync(dirname(dbPath), {recursive: true});
    const db = openDatabase(dbPath, {log: options.log});
    try {
        db.run(sql`PRAGMA foreign_keys = OFF`);
        migrate(db, {migrationsFolder});
        const foreignKeyViolations = db.$client.query("PRAGMA foreign_key_check").all();
        if (foreignKeyViolations.length > 0) throw new Error(`SQLite migration left foreign key violations: ${JSON.stringify(foreignKeyViolations)}`);
        db.run(sql`PRAGMA foreign_keys = ON`);
    } finally {
        db.run(sql`PRAGMA foreign_keys = ON`);
        closeDatabase(db);
    }
    io?.stdout.write("SQLite migrations applied successfully.\n");
}
