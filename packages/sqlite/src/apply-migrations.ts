import {createRootLogger, resolveLogConfigFromEnv} from "@tomekin/core";

import {applySqliteMigrations} from "./migrations";

if (import.meta.main) {
    const log = createRootLogger(resolveLogConfigFromEnv(process.env));
    applySqliteMigrations(undefined, {log}, {
        stdout: {write: (message) => process.stdout.write(message)},
    });
}
