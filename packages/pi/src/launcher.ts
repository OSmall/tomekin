import {mkdir, readFile, rename, rm, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
export {supportedPiVersion, assertPiVersion} from "./runtime-version";
import {supportedPiVersion} from "./runtime-version";

const basePiToolNames = [
    "draft_deck_building_brief", "search_cards", "lookup_cards", "browse_collection_cards", "hypergeometric_calculator", "browse_tags",
    "search_card_sets", "get_format_constraints",
    "validate_format_legality", "evaluate_deck_candidate", "check_collection_availability", "render_deck_candidate", "create_deck_candidate", "edit_deck_candidate",
    "get_deck_candidate", "list_deck_candidates", "list_collection_locations", "calculate", "read", "ask_user",
] as const;

export function resolvePiToolNames(environment: Record<string, string | undefined> = process.env): readonly (typeof basePiToolNames[number] | "legacy_query_cards")[] {
    return [...basePiToolNames, ...(environment.TOMEKIN_ENABLE_LEGACY_QUERY === "true" ? ["legacy_query_cards" as const] : [])];
}
export const expectedPiToolNames = resolvePiToolNames();

/** Review anchor; Bun's lockfile records the matching package integrity. */
export const reviewedAskUserPackage = {
    source: "npm:pi-ask-user@0.15.0",
    integrity: "sha512-wmgcHUSGptAS+u+9AT4Fbjxo+iclOXERDym9m/VeX7pDcVs5vwloSKP+BcQ96beuxMEVEhFVydPkXzoYmIvpVQ==",
} as const;

/** Packages are installed by Bun; Pi loads only the two explicit extension files. */
export function createPiProfileSettings(existing: Record<string, unknown> = {}) {
    return {...existing, packages: []};
}

export async function configurePiProfile(workspacePath: string): Promise<void> {
    const profilePath = join(workspacePath, ".data", "pi");
    await mkdir(profilePath, {recursive: true});
    const settingsPath = join(profilePath, "settings.json");
    let existing: Record<string, unknown> = {};
    try {
        const parsed: unknown = JSON.parse(await readFile(settingsPath, "utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object.");
        existing = parsed as Record<string, unknown>;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw new Error(`Cannot read Pi settings at ${settingsPath}; repair the file before launching Tomekin.`, {cause: error});
        }
    }
    const staging = join(profilePath, `.settings-${crypto.randomUUID()}.tmp`);
    try {
        await writeFile(staging, `${JSON.stringify(createPiProfileSettings(existing), null, 2)}\n`);
        await rename(staging, settingsPath);
    } finally {
        await rm(staging, {force: true});
    }
}

export function resolveAskUserExtensionPath(): string {
    // A file selects only the extension; selecting the package directory also loads its skills.
    return join(dirname(fileURLToPath(import.meta.resolve("pi-ask-user/package.json"))), "index.ts");
}

export function createPiSpawnConfiguration(options: {
    readonly workspacePath: string;
    readonly extensionPath: string;
    readonly executablePath?: string;
    readonly askUserExtensionPath?: string;
    readonly environment?: Record<string, string | undefined>;
}) {
    const environment: Record<string, string | undefined> = {...process.env, ...options.environment, PI_CODING_AGENT_DIR: join(options.workspacePath, ".data", "pi")};
    return {
        executable: options.executablePath ?? process.execPath,
        args: [
            fileURLToPath(new URL("./pi-main.ts", import.meta.url)),
            "--no-extensions", "--no-mcp", "--no-approve",
            "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes", "--no-builtin-tools",
            "--skill", join(options.workspacePath, "skills"),
            "--tools", resolvePiToolNames(environment).join(","),
            "--extension", options.askUserExtensionPath ?? resolveAskUserExtensionPath(),
            "--extension", options.extensionPath,
        ],
        cwd: options.workspacePath,
        env: environment,
        stdin: "inherit" as const,
        stdout: "inherit" as const,
        stderr: "inherit" as const,
    };
}

export async function buildTomekinExtension(
    workspacePath: string,
    runtimeRoot = join(workspacePath, ".data", "tomekin-pi-runtime", supportedPiVersion),
): Promise<string> {
    await mkdir(runtimeRoot, {recursive: true});
    const extension = join(runtimeRoot, "tomekin-extension.mjs");
    const worker = join(runtimeRoot, "tomekin-tomekin-worker.mjs");
    const built = await Bun.build({
        entrypoints: [join(workspacePath, "packages", "pi", "src", "extension.ts"), join(workspacePath, "packages", "pi", "src", "tomekin-worker.ts")],
        outdir: runtimeRoot,
        naming: "tomekin-[name].mjs",
        target: "bun",
        format: "esm",
    });
    if (!built.success) throw new Error(`Could not build Tomekin's Pi extension: ${built.logs.map(String).join("\n")}`);
    if (!existsSync(extension) || !existsSync(worker)) throw new Error("Could not stage Tomekin's Pi Worker entry point.");
    return extension;
}

export async function launchTomekinPi(workspacePath: string, ports = {
    buildExtension: buildTomekinExtension,
    configureProfile: configurePiProfile,
    spawn: (command: string[], options: ReturnType<typeof createPiSpawnConfiguration>) => Bun.spawn(command, options),
}): Promise<number> {
    // Do not touch the persistent profile if the extension cannot be built.
    const extensionPath = await ports.buildExtension(workspacePath);
    await ports.configureProfile(workspacePath);
    const configuration = createPiSpawnConfiguration({workspacePath, extensionPath});
    const child = ports.spawn([configuration.executable, ...configuration.args], configuration);
    return child.exited;
}
