import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

// A source archive retains the entire old composition, schema, repositories and adapters.
// Using current workspace imports here would silently stop being a legacy comparator after migration.
const pin = JSON.parse(readFileSync(new URL("./legacy-source.json", import.meta.url), "utf8")) as {commit: string};
if (!/^[0-9a-f]{40}$/.test(pin.commit)) throw new Error("Invalid legacy source commit");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "tomekin-legacy-evaluation-"));
try {
    const archive = execFileSync("git", ["archive", pin.commit], {cwd: root, maxBuffer: 64 * 1024 * 1024});
    execFileSync("tar", ["-xf", "-", "-C", directory], {input: archive});
    execFileSync(process.execPath, ["install", "--offline", "--frozen-lockfile"], {cwd: directory, stdio: ["ignore", "ignore", "inherit"]});
    const report = execFileSync(process.execPath, ["run", "evaluate:baseline"], {
        cwd: directory,
        env: {...process.env, TOMEKIN_LOG_ENABLED: "false", TOMEKIN_EVALUATION_SOURCE_COMMIT: pin.commit},
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "inherit"],
    });
    process.stdout.write(report);
} finally {rmSync(directory, {recursive: true, force: true});}
