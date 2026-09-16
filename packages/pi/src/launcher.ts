import {createHash} from "node:crypto";
import {chmod, mkdir, readFile, rename, rm} from "node:fs/promises";
import {existsSync} from "node:fs";
import {basename, join} from "node:path";

export const expectedPiToolNames = ["summarize_reference_support"] as const;

export type PiArtifact = {
    readonly version: "0.85.1";
    readonly archiveName: "pi-darwin-arm64.tar.gz";
    readonly url: "https://github.com/earendil-works/pi/releases/download/v0.85.1/pi-darwin-arm64.tar.gz";
    readonly sha256: "d5f70e3c0cf7398eac239fd0261ee074d98b7ba7f6b43fe3617f052ed5b79d06";
};

const macOsArm64Artifact: PiArtifact = {
    version: "0.85.1",
    archiveName: "pi-darwin-arm64.tar.gz",
    url: "https://github.com/earendil-works/pi/releases/download/v0.85.1/pi-darwin-arm64.tar.gz",
    sha256: "d5f70e3c0cf7398eac239fd0261ee074d98b7ba7f6b43fe3617f052ed5b79d06",
};

export function piArtifactForPlatform(platform: string, architecture: string): PiArtifact {
    if (platform !== "darwin" || architecture !== "arm64") {
        throw new Error(`Tomekin's Pi launcher currently supports only macOS arm64; received ${platform} ${architecture}.`);
    }
    return macOsArm64Artifact;
}

export async function verifyPiArtifact(options: {
    readonly artifact: PiArtifact;
    readonly archivePath: string;
    readonly executablePath: string;
    readonly sha256File: (path: string) => Promise<string>;
    readonly runVersion: (path: string) => Promise<{readonly exitCode: number; readonly stdout: string}>;
}): Promise<void> {
    const actualChecksum = await options.sha256File(options.archivePath);
    if (actualChecksum !== options.artifact.sha256) {
        throw new Error(`Pi artifact checksum mismatch: expected ${options.artifact.sha256}, received ${actualChecksum}.`);
    }
    await verifyPiExecutable(options);
}

export function createPiSpawnConfiguration(options: {
    readonly workspacePath: string;
    readonly executablePath: string;
    readonly extensionPath: string;
    readonly environment?: Record<string, string | undefined>;
}) {
    return {
        executable: options.executablePath,
        args: [
            "--no-extensions", "--no-skills", "--no-context-files", "--no-builtin-tools",
            "--tools", expectedPiToolNames.join(","), "--extension", options.extensionPath,
        ],
        cwd: options.workspacePath,
        env: {...process.env, ...options.environment, PI_CODING_AGENT_DIR: join(options.workspacePath, ".data", "pi")},
        stdin: "inherit" as const,
        stdout: "inherit" as const,
        stderr: "inherit" as const,
    };
}

/** The launcher owns only transient staging; Pi's profile and Tomekin's database persist. */
export function shouldCleanLauncherPath(kind: "staging" | "profile" | "database"): boolean {
    return kind === "staging";
}

export async function ensureVerifiedPiArtifact(options: {
    readonly workspacePath: string;
    readonly fetchArchive?: (url: string) => Promise<Response>;
}): Promise<string> {
    const artifact = piArtifactForPlatform(process.platform, process.arch);
    const runtimeRoot = join(options.workspacePath, ".data", "tomekin-pi-runtime");
    const cacheRoot = join(runtimeRoot, artifact.version);
    const executablePath = join(cacheRoot, "pi", "pi");
    const runVersion = async (path: string) => {
        const result = Bun.spawnSync([path, "--version"]);
        return {exitCode: result.exitCode, stdout: new TextDecoder().decode(result.stdout)};
    };
    if (existsSync(executablePath)) {
        await verifyPiExecutable({artifact, executablePath, runVersion});
        return executablePath;
    }

    const staging = join(runtimeRoot, `.staging-${crypto.randomUUID()}`);
    await mkdir(staging, {recursive: true});
    try {
        const response = await (options.fetchArchive ?? fetch)(artifact.url);
        if (!response.ok) throw new Error(`Pi release download failed: ${response.status} ${response.statusText}.`);
        const archive = join(staging, artifact.archiveName);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const checksum = createHash("sha256").update(bytes).digest("hex");
        if (checksum !== artifact.sha256) throw new Error(`Pi archive checksum mismatch: expected ${artifact.sha256}, received ${checksum}.`);
        await Bun.write(archive, bytes);
        const unpack = Bun.spawnSync(["tar", "-xzf", archive, "-C", staging]);
        if (unpack.exitCode !== 0) throw new Error(`Could not unpack the verified Pi archive (exit ${unpack.exitCode}).`);
        const stagedExecutable = join(staging, "pi", "pi");
        if (!existsSync(stagedExecutable)) throw new Error("Verified Pi archive did not contain its expected executable.");
        await chmod(stagedExecutable, 0o755);
        await verifyPiArtifact({
            artifact,
            archivePath: archive,
            executablePath: stagedExecutable,
            sha256File: async (path) => createHash("sha256").update(await readFile(path)).digest("hex"),
            runVersion,
        });
        await rm(cacheRoot, {recursive: true, force: true});
        await mkdir(cacheRoot, {recursive: true});
        await rename(join(staging, "pi"), join(cacheRoot, "pi"));
        return executablePath;
    } finally {
        if (shouldCleanLauncherPath("staging")) await rm(staging, {recursive: true, force: true});
    }
}

async function verifyPiExecutable(options: {
    readonly artifact: PiArtifact;
    readonly executablePath: string;
    readonly runVersion: (path: string) => Promise<{readonly exitCode: number; readonly stdout: string}>;
}): Promise<void> {
    const version = await options.runVersion(options.executablePath);
    if (version.exitCode !== 0 || version.stdout.trim() !== options.artifact.version) {
        throw new Error(`Verified Pi artifact did not report version ${options.artifact.version}.`);
    }
}

export async function buildTomekinExtension(workspacePath: string): Promise<string> {
    const runtimeRoot = join(workspacePath, ".data", "tomekin-pi-runtime", macOsArm64Artifact.version);
    await mkdir(runtimeRoot, {recursive: true});
    const extension = join(runtimeRoot, "tomekin-extension.mjs");
    const built = await Bun.build({
        entrypoints: [join(workspacePath, "packages", "pi", "src", "extension.ts")],
        outdir: runtimeRoot,
        naming: basename(extension),
        target: "bun",
        format: "esm",
    });
    if (!built.success) throw new Error(`Could not build Tomekin's Pi extension: ${built.logs.map(String).join("\n")}`);
    return extension;
}

export async function launchTomekinPi(workspacePath: string, ports = {
    ensureArtifact: (path: string) => ensureVerifiedPiArtifact({workspacePath: path}),
    buildExtension: buildTomekinExtension,
    spawn: (command: string[], options: ReturnType<typeof createPiSpawnConfiguration>) => Bun.spawn(command, options),
}): Promise<number> {
    const executablePath = await ports.ensureArtifact(workspacePath);
    const extensionPath = await ports.buildExtension(workspacePath);
    const configuration = createPiSpawnConfiguration({workspacePath, executablePath, extensionPath});
    const child = ports.spawn([configuration.executable, ...configuration.args], configuration);
    return child.exited;
}
