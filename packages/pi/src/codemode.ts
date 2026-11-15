import {createCodemodeExtension, type ExtensionAPI} from "@earendil-works/pi-coding-agent";

/** Use Pi's native sandbox without granting its optional model calls. Commit stores only after
 * the entire outer result is delivered: a truncated result must not advance a traversal. */
export default function registerCodemode(pi: ExtensionAPI): void {
    let pending: Array<{type: string; data: unknown}> | undefined;
    const proxy = Object.create(pi) as ExtensionAPI;
    proxy.appendEntry = (type, data) => { pending?.push({type, data}); };
    proxy.registerTool = (definition) => {
        const execute = definition.execute;
        pi.registerTool({
            ...definition,
            executionMode: "sequential",
            async execute(...args) {
                if (pending) throw new Error("Another codemode script is still running.");
                pending = [];
                try {
                    const result = await execute(...args);
                    const truncated = result.content.some((block) => block.type === "text" && block.text.startsWith("Warning: truncated output"));
                    if (truncated) return {
                        ...result,
                        isError: true,
                        content: [...result.content, {type: "text" as const, text: "Output was truncated and is incomplete. The checkpoint was not committed. Resume reads from the previous committed cursor and reduce the output; do not rely on the temporary file. If a mutation was dispatched, inspect its saved outcome before retrying."}],
                    };
                    if (args[2]?.aborted && !result.isError) return {
                        ...result,
                        isError: true,
                        content: [...result.content, {type: "text" as const, text: "The script was interrupted; its checkpoint was not committed. Inspect any dispatched mutation before retrying."}],
                    };
                    if (!result.isError) for (const entry of pending) pi.appendEntry(entry.type, entry.data);
                    return result;
                } finally {
                    pending = undefined;
                }
            },
        });
    };
    createCodemodeExtension({models: false, mode: "on"})(proxy);
}
