import {applySqliteMigrations} from "./migrations";

if (import.meta.main) {
    applySqliteMigrations(undefined, {
        stdout: {write: (message) => process.stdout.write(message)},
    });
}
