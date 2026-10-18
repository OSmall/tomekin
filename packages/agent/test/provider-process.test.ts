import {expect, test} from "bun:test";
import {mkdtempSync, rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";

test("one provider process owns all databases and an interrupted owner restarts conservatively", async () => {
    const directory = mkdtempSync(join(tmpdir(), "provider-process-"));
    const module = new URL("../src/provider.ts", import.meta.url).href;
    const prefix = `import {getProcessCardSearchProvider} from ${JSON.stringify(module)};const provider=getProcessCardSearchProvider();`;
    const spawn = (code: string) =>
        Bun.spawn([process.execPath, "-e", prefix + code], {
            env: {
                ...process.env,
                XDG_STATE_HOME: directory,
                TOMEKIN_LOG_ENABLED: "false",
            },
            stdout: "pipe",
            stderr: "pipe",
        });
    const first = spawn('console.log("claimed");await Bun.sleep(60000);');
    try {
        const reader = first.stdout.getReader();
        const claim = await reader.read();
        reader.releaseLock();
        expect(new TextDecoder().decode(claim.value)).toContain("claimed");
        const second = spawn('console.log("unexpected");');
        expect(await second.exited).not.toBe(0);
        expect(await new Response(second.stderr).text()).toContain(
            "Another Tomekin process owns Scryfall search",
        );
        first.kill("SIGKILL");
        await first.exited;
        const recovered = spawn(
            'try{await provider.dispatch("https://api.scryfall.com/cards/search?q=never-sent",{remainingMs:1});throw new Error("unexpected dispatch");}catch(error){console.log(JSON.stringify(error.problem));}',
        );
        expect(await recovered.exited).toBe(0);
        const result = JSON.parse(await new Response(recovered.stdout).text());
        expect(result).toMatchObject({code: "rate_limited", retryable: true});
        expect(result.retry_after_ms).toBeGreaterThan(30000);
    } finally {
        first.kill("SIGKILL");
        await first.exited;
        rmSync(directory, {recursive: true, force: true});
    }
});
