import {mkdir, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {
    createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, VERSION,
} from "@earendil-works/pi-coding-agent";
import {buildTomekinExtension, expectedPiToolNames, resolveAskUserExtensionPath} from "@tomekin/pi";
import {createLookupFixture} from "../../../agent/test/fixtures/lookup";

// This subprocess receives isolated profile storage and no account credentials.
const workspace = fileURLToPath(new URL("../../../../", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "tomekin-pi-package-"));
const fixture = await createLookupFixture();
process.env.TOMEKIN_DB_PATH = fixture.databasePath;
const errors: string[] = [];
let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
try {
    const agentDir = process.env.PI_CODING_AGENT_DIR!;
    await mkdir(agentDir, {recursive: true});
    const extension = await buildTomekinExtension(workspace, join(directory, "bundles"));
    const settingsManager = SettingsManager.create(workspace, agentDir);
    settingsManager.setProjectTrusted(false);
    const resourceLoader = new DefaultResourceLoader({
        cwd: workspace, agentDir, settingsManager,
        additionalExtensionPaths: [resolveAskUserExtensionPath(), extension],
        additionalSkillPaths: [join(workspace, "skills")],
        noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true,
    });
    await resourceLoader.reload();
    if (resourceLoader.getExtensions().errors.length) throw new Error(JSON.stringify(resourceLoader.getExtensions().errors));
    const modelRuntime = await ModelRuntime.create({
        authPath: join(agentDir, "auth.json"), modelsStorePath: join(agentDir, "models-store.json"),
        modelsPath: null, allowModelNetwork: false, refreshOnCreate: false,
    });
    ({session} = await createAgentSession({
        cwd: workspace, agentDir, settingsManager, resourceLoader, modelRuntime,
        sessionManager: SessionManager.inMemory(workspace), tools: [...expectedPiToolNames], noTools: "builtin",
    }));
    await session.bindExtensions({onError: error => errors.push(JSON.stringify(error))});
    const invoke = async (name: string, input: Record<string, unknown>) => {
        const tool = session!.agent.state.tools.find(tool => tool.name === name);
        if (!tool) throw new Error(`Missing tool ${name}`);
        return tool.execute(`package-smoke-${name}`, input, new AbortController().signal);
    };
    const lookup = await invoke("lookup_cards", {references: [{kind: "name", value: "Sol Ring"}], select: {name: true, oracle_text: true}});
    const calculator = await invoke("hypergeometric_calculator", {operation: "probability", populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "exactly", count: 1}});
    const skill = await invoke("read", {path: "skills/tomekin-deck-building/SKILL.md", limit: 2});
    const denied = await invoke("read", {path: "package.json"});
    const beforeReload = session.getActiveToolNames();
    await session.reload();
    const afterReload = session.getActiveToolNames();
    const afterReloadLookup = await invoke("lookup_cards", {references: [{kind: "name", value: "Sol Ring"}], select: {name: true, oracle_text: true}});
    console.log(JSON.stringify({
        version: VERSION, beforeReload, afterReload, errors,
        lookup: lookup.details, afterReloadLookup: afterReloadLookup.details,
        calculator: calculator.details, skill: skill.content, denied: denied.details,
        skills: resourceLoader.getSkills().skills.map(skill => skill.name),
        contexts: resourceLoader.getAgentsFiles().agentsFiles.length,
        prompts: resourceLoader.getPrompts().prompts.length,
        extensions: resourceLoader.getExtensions().extensions.map(extension => extension.path),
    }));
} finally {
    if (session) {
        await session.extensionRunner.emit({type: "session_shutdown", reason: "quit"});
        session.dispose();
    }
    fixture.dispose();
    await rm(directory, {recursive: true, force: true});
}
