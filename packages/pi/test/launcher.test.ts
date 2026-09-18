import {describe, expect, test} from "bun:test";
import {
    createPiProfileSettings, reviewedAskUserPackage,
    createPiSpawnConfiguration,
    expectedPiToolNames,
    launchTomekinPi,
    piArtifactForPlatform,
    shouldCleanLauncherPath,
    verifyPiArtifact,
} from "@tomekin/pi";

describe("Pi launcher", () => {
    test("selects only the pinned macOS arm64 artifact", () => {
        expect(piArtifactForPlatform("darwin", "arm64")).toMatchObject({
            version: "0.85.1",
            archiveName: "pi-darwin-arm64.tar.gz",
            sha256: "d5f70e3c0cf7398eac239fd0261ee074d98b7ba7f6b43fe3617f052ed5b79d06",
        });
        expect(() => piArtifactForPlatform("linux", "x64")).toThrow("macOS arm64");
    });

    test("rejects cache entries with a mismatched checksum or version", async () => {
        const artifact = piArtifactForPlatform("darwin", "arm64");
        await expect(verifyPiArtifact({
            artifact,
            archivePath: "/cache/pi-darwin-arm64.tar.gz",
            executablePath: "/cache/pi",
            sha256File: async (path) => {
                expect(path).toBe("/cache/pi-darwin-arm64.tar.gz");
                return "wrong";
            },
            runVersion: async () => ({exitCode: 0, stdout: "0.85.1\n"}),
        })).rejects.toThrow("checksum mismatch");
        await expect(verifyPiArtifact({
            artifact,
            archivePath: "/cache/pi-darwin-arm64.tar.gz",
            executablePath: "/cache/pi",
            sha256File: async () => artifact.sha256,
            runVersion: async () => ({exitCode: 0, stdout: "0.85.0\n"}),
        })).rejects.toThrow("did not report version 0.85.1");
    });

    test("inherits terminal I/O and allows only the approved interactive registry", () => {
        const configuration = createPiSpawnConfiguration({
            workspacePath: "/clone",
            executablePath: "/cache/pi",
            extensionPath: "/cache/tomekin-extension.mjs",
            environment: {TOMEKIN_DB_PATH: "/isolated.sqlite"},
        });

        expect(configuration.stdin).toBe("inherit");
        expect(configuration.stdout).toBe("inherit");
        expect(configuration.stderr).toBe("inherit");
        expect(configuration.env.PI_CODING_AGENT_DIR).toBe("/clone/.data/pi");
        expect(configuration.args).toEqual(expect.arrayContaining<string>([
            "--no-skills", "--no-context-files", "--no-builtin-tools",
            "--skill", "/clone/skills",
            "--tools", expectedPiToolNames.join(","), "--extension", "/cache/tomekin-extension.mjs",
        ]));
        expect(expectedPiToolNames).toContain("ask_user");
    });

    test("loads only the reviewed ask-user extension package and no bundled resources", () => {
        expect(createPiProfileSettings()).toEqual({
            packages: [{
                source: "npm:pi-ask-user@0.15.0",
                extensions: ["index.ts"], skills: [], prompts: [], themes: [],
            }],
        });
        expect(reviewedAskUserPackage.integrity).toBe("sha512-wmgcHUSGptAS+u+9AT4Fbjxo+iclOXERDym9m/VeX7pDcVs5vwloSKP+BcQ96beuxMEVEhFVydPkXzoYmIvpVQ==");
    });

    test("propagates the spawned Pi exit status and retains the profile and database", async () => {
        const exitCode = await launchTomekinPi("/clone", {
            ensureArtifact: async () => "/cache/pi",
            buildExtension: async () => "/cache/extension.mjs",
            configureProfile: async () => {},
            spawn: (command, options) => {
                expect(command).toEqual(expect.arrayContaining(["/cache/pi", "--extension", "/cache/extension.mjs"]));
                expect(options.stdin).toBe("inherit");
                return {exited: Promise.resolve(130)} as never;
            },
        });
        expect(exitCode).toBe(130);
        expect(shouldCleanLauncherPath("staging")).toBe(true);
        expect(shouldCleanLauncherPath("profile")).toBe(false);
        expect(shouldCleanLauncherPath("database")).toBe(false);
    });
});
