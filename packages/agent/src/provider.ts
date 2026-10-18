import {
    mkdirSync,
    readFileSync,
    writeFileSync,
    renameSync,
    rmSync,
    openSync,
    fsyncSync,
    closeSync,
} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";
import {
    createProviderDispatchOwner,
    retryAfterDelay,
    isScryfallMigrationPageUrl,
    validateSearchPageUrl,
    ProviderFailure,
    type CardSearchProvider,
    type Logger,
    type ProviderControlState,
} from "@tomekin/core";
let provider: CardSearchProvider | undefined;
/** One enforced provider process per user. Lazily claimed, independent of database/runtime/Worker. */
export function getProcessCardSearchProvider(log?: Logger): CardSearchProvider {
    try {
        return claimProcessProvider(log);
    } catch (error) {
        if (error instanceof ProviderFailure) throw error;
        throw new ProviderFailure({
            code: "provider_error",
            message:
                error instanceof Error
                    ? error.message
                    : "Provider setup failed.",
            retryable: false,
            reason: "provider_setup_failure",
        });
    }
}
function claimProcessProvider(log?: Logger): CardSearchProvider {
    if (provider) return provider;
    const directory = join(
        process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
        "tomekin",
        "scryfall",
    );
    mkdirSync(directory, {recursive: true, mode: 0o700});
    const lock = join(directory, "owner"),
        stateFile = join(directory, "control.json");
    let recovered = false;
    try {
        mkdirSync(lock, {mode: 0o700});
    } catch {
        let pid: number;
        try {
            pid = Number(readFileSync(join(lock, "pid"), "utf8"));
            if (!Number.isInteger(pid) || pid <= 0)
                throw new Error("unreadable");
        } catch {
            throw new Error(
                "Provider process ownership is uncertain; inspect the Tomekin provider owner directory before restarting.",
            );
        }
        try {
            process.kill(pid, 0);
            throw new Error(
                "Another Tomekin process owns Scryfall API access. Use one active provider process per user.",
            );
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
        const recovery = lock + ".recovery";
        try {
            mkdirSync(recovery, {mode: 0o700});
        } catch {
            throw new Error(
                "Another provider owner recovery is active or uncertain. Inspect the provider ownership directory.",
            );
        }
        try {
            const retained = Number(readFileSync(join(lock, "pid"), "utf8"));
            if (retained !== pid)
                throw new Error(
                    "Provider ownership changed during recovery; retry using the active process.",
                );
            try {
                process.kill(retained, 0);
                throw new Error(
                    "Another Tomekin process owns Scryfall API access.",
                );
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== "ESRCH")
                    throw error;
            }
            rmSync(lock, {recursive: true});
            mkdirSync(lock, {mode: 0o700});
            recovered = true;
        } finally {
            rmSync(recovery, {recursive: true, force: true});
        }
    }
    writeFileSync(join(lock, "pid"), String(process.pid), {mode: 0o600});
    let initial: ProviderControlState | undefined;
    try {
        const raw = JSON.parse(readFileSync(stateFile, "utf8"));
        if (
            raw.version !== 1 ||
            raw.provider !== "scryfall" ||
            typeof raw.cooldownWallUntil !== "number" ||
            typeof raw.uncertain !== "boolean"
        )
            throw new Error("Invalid provider state");
        initial = raw;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
            initial = {
                version: 1,
                provider: "scryfall",
                cooldownWallUntil: Date.now() + 31000,
                uncertain: true,
            };
    }
    if (recovered)
        initial = {
            version: 1,
            provider: "scryfall",
            cooldownWallUntil: initial?.cooldownWallUntil ?? 0,
            uncertain: true,
        };
    const persist = (state: ProviderControlState) => {
        const temp = stateFile + `.${process.pid}.tmp`;
        writeFileSync(temp, JSON.stringify(state), {mode: 0o600, flush: true});
        renameSync(temp, stateFile);
        const fd = openSync(directory, "r");
        try {
            fsyncSync(fd);
        } finally {
            closeSync(fd);
        }
    };
    provider = createProviderDispatchOwner({
        ...(initial ? {initialState: initial} : {}),
        persist,
        ...(log ? {log} : {}),
        intervalMs: url => new URL(url).pathname === "/cards/search" ? 500 : 100,
        dispatch: dispatchScryfallHttp,
    });
    process.once("exit", () => {
        try {
            persist({
                version: 1,
                provider: "scryfall",
                cooldownWallUntil: JSON.parse(readFileSync(stateFile, "utf8"))
                    .cooldownWallUntil,
                uncertain: true,
            });
        } catch {}
        try {
            rmSync(lock, {recursive: true});
        } catch {}
    });
    return provider;
}

/** Shared HTTP transport; its owner observes 429 before delivering to disposable callers. */
export async function dispatchScryfallHttp(url: string, wallNow = () => Date.now()) {

            if (!validateSearchPageUrl(url, {}) && url !== "https://api.scryfall.com/bulk-data" && !isScryfallMigrationPageUrl(url))
                throw new ProviderFailure({
                    code: "provider_error",
                    message: "Unsupported provider search address.",
                    reason: "invalid_response",
                    retryable: false,
                });
            const controller = new AbortController(),
                timer = setTimeout(() => controller.abort(), 120000);
            try {
                const response = await fetch(url, {
                    signal: controller.signal,
                    redirect: "error",
                    headers: {
                        "User-Agent": "Tomekin/0.0.0 (reference data and card search)",
                        Accept: "application/json",
                    },
                });
                // Persist observed cooldown before any disposable caller receives status or body.
                const retry =
                    response.status === 429
                        ? retryAfterDelay(
                              response.headers.get("Retry-After"),
                              wallNow(),
                          )
                        : undefined;
                if (response.status === 429) {
                    void response.body?.cancel();
                    return {status: 429, body: null, retryAfterMs: retry!};
                }
                const maxBytes = new URL(url).pathname === "/cards/search" ? 64 * 1024 * 1024 : 1024 * 1024;
                const reader = response.body?.getReader();
                let bytes = 0;
                const chunks: Uint8Array[] = [];
                if (reader) {
                    try {
                        while (true) {
                            const item = await reader.read();
                            if (item.done) break;
                            bytes += item.value.byteLength;
                            if (bytes > maxBytes) { await reader.cancel(); throw new Error("Scryfall response byte budget exhausted."); }
                            chunks.push(item.value);
                        }
                    } finally { reader.releaseLock(); }
                }
                const combined = new Uint8Array(bytes);
                let offset = 0;
                for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
                const body = JSON.parse(new TextDecoder().decode(combined));
                return {status: response.status, body, responseBytes: bytes};
            } catch {
                throw new ProviderFailure({
                    code: "provider_error",
                    message: "Scryfall HTTP transport failed.",
                    reason: "transport_failure",
                    retryable: true,
                });
            } finally {
                clearTimeout(timer);
            }
}
