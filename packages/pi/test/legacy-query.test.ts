import {expect, test} from "bun:test";
import {createPiSpawnConfiguration, resolvePiToolNames} from "@tomekin/pi";

test("Pi launcher tool list follows its effective child environment in both directions", () => {
    for (const enabled of [true, false]) {
        const environment = {
            TOMEKIN_ENABLE_LEGACY_QUERY: enabled ? "true" : "false",
        };
        const config = createPiSpawnConfiguration({
            workspacePath: "/fixture",
            executablePath: "/pi",
            extensionPath: "/extension",
            environment,
        });
        const names =
            config.args[config.args.indexOf("--tools") + 1]!.split(",");
        expect(names).toEqual([...resolvePiToolNames(config.env)]);
        expect(names.includes("legacy_query_cards")).toBe(enabled);
        expect(names).not.toContain("query_cards");
    }
});
for (const enabled of [true, false])
    test(`actual enabled=${enabled} adapter registries agree on legacy exposure and execution`, async () => {
        const root = new URL("../../../", import.meta.url),
            tools = new URL(".opencode/tools/tomekin.ts", root).href,
            pi = new URL("packages/pi/src/index.ts", root).href,
            agent = new URL("packages/agent/src/index.ts", root).href,
            opencode = new URL("packages/opencode/src/index.ts", root).href,
            fixtures = new URL("packages/agent/test/fixtures/lookup.ts", root)
                .href,
            worker = new URL("packages/pi/src/tomekin-worker.ts", root).href;
        // OpenCode v1.18.13 registry.ts:179-181,329-331 filters module exports by this exact guard.
        const code = `import * as tools from ${JSON.stringify(tools)};import {tool} from "@opencode-ai/plugin";import {expectedPiToolNames,auditPiToolRegistry,createCoreTool,createPiWorkerTransport} from ${JSON.stringify(pi)};import {createLocalAgentToolRuntime} from ${JSON.stringify(agent)};import {createLocalAgentToolHandlers} from ${JSON.stringify(opencode)};import {createLookupFixture,log} from ${JSON.stringify(fixtures)};
 const loaded=Object.entries(tools).filter(([,value])=>typeof value==="object"&&value!==null&&"args" in value&&"description" in value&&"execute" in value);
 for(const [,definition] of loaded)tool.schema.toJSONSchema(tool.schema.object(definition.args),{metadata:tool.schema.registry()});
 auditPiToolRegistry(expectedPiToolNames);let counts=[];
 if(${enabled}){const fixture=await createLookupFixture({tags:true});const restore=tools.configureAgentToolRuntimeForTests({log,createHandlers:options=>createLocalAgentToolHandlers({...options,databasePath:fixture.databasePath})});const transport=createPiWorkerTransport({workerUrl:${JSON.stringify(worker)}});try{counts.push(JSON.parse(await tools.legacy_query_cards.execute({limit:1})).items.length);for(const mode of ["fallback","worker"]){const definition=createCoreTool("legacy_query_cards",{log,...(mode==="worker"?{transport,databasePath:fixture.databasePath}:{createRuntime:()=>createLocalAgentToolRuntime({databasePath:fixture.databasePath,log})})});const output=await definition.execute(mode,{limit:1},new AbortController().signal);counts.push(JSON.parse(output.content[0].text).items.length);}}finally{restore();await transport.close();fixture.dispose();}}
 console.log(JSON.stringify({opencode:loaded.map(([name])=>name),pi:expectedPiToolNames,counts}));`;
        const child = Bun.spawn([process.execPath, "-e", code], {
            cwd: new URL("../../../", import.meta.url).pathname,
            env: {
                ...process.env,
                TOMEKIN_ENABLE_LEGACY_QUERY: enabled ? "true" : "false",
                TOMEKIN_LOG_ENABLED: "false",
            },
            stdout: "pipe",
            stderr: "pipe",
        });
        const output = await new Response(child.stdout).text(),
            stderr = await new Response(child.stderr).text();
        expect(await child.exited, stderr).toBe(0);
        const actual = JSON.parse(output);
        expect(actual.opencode.includes("legacy_query_cards")).toBe(enabled);
        expect(actual.pi.includes("legacy_query_cards")).toBe(enabled);
        expect(actual.opencode).not.toContain("query_cards");
        if (enabled) expect(actual.counts).toEqual([1, 1, 1]);
    });
