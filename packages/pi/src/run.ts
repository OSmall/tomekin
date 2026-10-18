import {launchTomekinPi} from "./launcher";
import {runDeckCandidateExportCommand} from "@tomekin/cli";
import {createRootLogger,resolveLogConfigFromEnv} from "@tomekin/core";
const args=process.argv.slice(2);
if(args[0] === "deck-candidate") {
    if(args[1] !== "export-plan") {
        process.stderr.write("Usage: tomekin deck-candidate export-plan <id> --format json|mermaid --projection strategy|selected|pool --output <path>\n");
        process.exitCode=1;
    }else process.exitCode=await runDeckCandidateExportCommand(args.slice(2),{TOMEKIN_DB_PATH:process.env.TOMEKIN_DB_PATH},process,{log:createRootLogger(resolveLogConfigFromEnv(process.env))});
}else process.exitCode=await launchTomekinPi(process.cwd());
