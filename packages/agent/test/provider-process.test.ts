import {expect, test} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
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
            "Another Tomekin process owns Scryfall API access",
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

test("settled request survives clean process exit without an uncertain recovery cooldown", async () => {
    const directory = mkdtempSync(join(tmpdir(), "provider-clean-"));
    const module = new URL("../src/provider.ts", import.meta.url).href;
    const run = (code: string) => Bun.spawn([process.execPath, "-e", `import {getProcessCardSearchProvider} from ${JSON.stringify(module)};${code}`], {
        env: {...process.env, XDG_STATE_HOME: directory}, stdout: "pipe", stderr: "pipe",
    });
    try {
        const first = run(`globalThis.fetch=async()=>new Response('{}',{status:200});await getProcessCardSearchProvider().dispatch('https://api.scryfall.com/cards/search?q=test',{remainingMs:10000});`);
        expect(await first.exited).toBe(0);
        const second = run(`globalThis.fetch=async()=>new Response('{}',{status:200});try { await getProcessCardSearchProvider().dispatch('https://api.scryfall.com/cards/search?q=test',{remainingMs:1}); console.log(JSON.stringify({code:'success'})); } catch (e) { console.log(JSON.stringify(e.problem)); }`);
        expect(await second.exited).toBe(0);
        expect(JSON.parse(await new Response(second.stdout).text()).code).not.toBe("rate_limited");
    } finally { rmSync(directory, {recursive: true, force: true}); }
});


test("corrupt state retains conservative recovery and reports its cause", async () => {
    const directory = mkdtempSync(join(tmpdir(), "provider-corrupt-"));
    const stateDir = join(directory, "tomekin", "scryfall");
    mkdirSync(stateDir, {recursive: true});
    writeFileSync(join(stateDir, "control.json"), "not json");
    const module = new URL("../src/provider.ts", import.meta.url).href;
    const code = `import {getProcessCardSearchProvider} from ${JSON.stringify(module)};const log={warn:o=>console.log(JSON.stringify(o)),info:o=>console.log(JSON.stringify(o)),child(){return this}};try{await getProcessCardSearchProvider(log).dispatch('https://api.scryfall.com/cards/search?q=private',{remainingMs:1})}catch(e){console.log(JSON.stringify(e.problem))}`;
    try {
        const child = Bun.spawn([process.execPath, "-e", code], {env: {...process.env, XDG_STATE_HOME: directory}, stdout: "pipe", stderr: "pipe"});
        expect(await child.exited).toBe(0);
        const output = await new Response(child.stdout).text();
        expect(output).toContain('"reason":"unreadable_or_corrupt_state"');
        expect(output).toContain('"code":"rate_limited"');
        expect(output).not.toContain("private");
    } finally { rmSync(directory, {recursive: true, force: true}); }
});
