import {assertPiVersion} from "./runtime-version";

// Match the upstream CLI's process markers before loading provider/extension modules.
process.title = "tomekin";
process.env.PI_CODING_AGENT = "true";
process.env.AI_AGENT = "pi";

// Import the public modular API. The npm bin entry is a Node-specific bundle.
const {main, VERSION} = await import("@earendil-works/pi-coding-agent");
assertPiVersion(VERSION);
await main(process.argv.slice(2));
