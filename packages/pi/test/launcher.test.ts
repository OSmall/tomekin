import {describe, expect, test} from "bun:test";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {
    configurePiProfile, createPiProfileSettings, reviewedAskUserPackage,
    createPiSpawnConfiguration, expectedPiToolNames, launchTomekinPi,
    assertPiVersion, supportedPiVersion, resolveAskUserExtensionPath,
} from "@tomekin/pi";

describe("Pi launcher", () => {
    test("preserves Pi settings while disabling independently installed packages", async () => {
        const workspace = await mkdtemp(join(tmpdir(), "tomekin-pi-profile-"));
        const profile = join(workspace, ".data", "pi");
        try {
            await mkdir(profile, {recursive: true});
            await writeFile(join(profile, "settings.json"), JSON.stringify({defaultProvider: "example", defaultModel: "chosen-model", packages: ["npm:pi-ask-user@0.15.0"]}));
            await configurePiProfile(workspace);
            await configurePiProfile(workspace);
            expect(JSON.parse(await readFile(join(profile, "settings.json"), "utf8"))).toEqual({defaultProvider: "example", defaultModel: "chosen-model", packages: []});
        } finally {
            await rm(workspace, {recursive: true, force: true});
        }
    });

    test("requires the exact Bun-managed dependency version", async () => {
        const manifest = await Bun.file(new URL("../package.json", import.meta.url)).json();
        expect(manifest.dependencies["@earendil-works/pi-coding-agent"]).toBe(supportedPiVersion);
        expect(() => assertPiVersion(supportedPiVersion)).not.toThrow();
        expect(() => assertPiVersion("0.85.1")).toThrow("bun install --frozen-lockfile");
    });

    test("rejects invalid settings without overwriting them", async () => {
        const workspace = await mkdtemp(join(tmpdir(), "tomekin-pi-settings-"));
        const profile = join(workspace, ".data", "pi");
        try {
            await mkdir(profile, {recursive: true});
            for (const invalid of ["{unfinished", "[]", "null"]) {
                await writeFile(join(profile, "settings.json"), invalid);
                await expect(configurePiProfile(workspace)).rejects.toThrow("repair the file");
                expect(await readFile(join(profile, "settings.json"), "utf8")).toBe(invalid);
            }
        } finally {
            await rm(workspace, {recursive: true, force: true});
        }
    });

    test("inherits terminal I/O and allows only the approved interactive registry", () => {
        const configuration = createPiSpawnConfiguration({
            workspacePath: "/clone",
            extensionPath: "/cache/tomekin-extension.mjs",
            askUserExtensionPath: "/dependencies/pi-ask-user/index.ts",
            environment: {TOMEKIN_DB_PATH: "/isolated.sqlite"},
        });
        expect(configuration.stdin).toBe("inherit");
        expect(configuration.stdout).toBe("inherit");
        expect(configuration.stderr).toBe("inherit");
        expect(configuration.executable).toBe(process.execPath);
        expect(configuration.args[0]).toEndWith(join("src", "pi-main.ts"));
        expect(configuration.env.PI_CODING_AGENT_DIR).toBe(join("/clone", ".data", "pi"));
        expect(configuration.args).toEqual(expect.arrayContaining<string>([
            "--no-extensions", "--no-mcp", "--no-approve",
            "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes", "--no-builtin-tools",
            "--skill", join("/clone", "skills"),
            "--tools", expectedPiToolNames.join(","),
        ]));
        const extensions = configuration.args.flatMap((argument, index) => argument === "--extension" ? [configuration.args[index + 1]] : []);
        expect(extensions).toEqual(["/dependencies/pi-ask-user/index.ts", "/cache/tomekin-extension.mjs"]);
        expect(configuration.env.TOMEKIN_DB_PATH).toBe("/isolated.sqlite");
    });

    test("loads the pinned local ask-user file without installing its bundled resources", async () => {
        expect(createPiProfileSettings()).toEqual({packages: []});
        expect(resolveAskUserExtensionPath()).toEndWith(join("pi-ask-user", "index.ts"));
        const manifest = await Bun.file(new URL("../package.json", import.meta.url)).json();
        expect(manifest.dependencies["pi-ask-user"]).toBe("0.15.0");
        expect(reviewedAskUserPackage.integrity).toBe("sha512-wmgcHUSGptAS+u+9AT4Fbjxo+iclOXERDym9m/VeX7pDcVs5vwloSKP+BcQ96beuxMEVEhFVydPkXzoYmIvpVQ==");
    });

    test("propagates the Bun child exit status", async () => {
        const exitCode = await launchTomekinPi("/clone", {
            buildExtension: async () => "/cache/extension.mjs",
            configureProfile: async () => {},
            spawn: (command, options) => {
                expect(command[0]).toBe(process.execPath);
                expect(command).toEqual(expect.arrayContaining(["--extension", "/cache/extension.mjs"]));
                expect(options.stdin).toBe("inherit");
                return {exited: Promise.resolve(130)} as never;
            },
        });
        expect(exitCode).toBe(130);
    });

    test("a failed extension build leaves the profile untouched and does not launch Pi", async () => {
        await expect(launchTomekinPi("/clone", {
            buildExtension: async () => {throw new Error("build failed");},
            configureProfile: async () => {throw new Error("profile must not be touched");},
            spawn: () => {throw new Error("Pi must not be launched");},
        })).rejects.toThrow("build failed");
    });
});
