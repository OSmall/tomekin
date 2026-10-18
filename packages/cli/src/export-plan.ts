import {randomUUID} from "node:crypto";
import {rename,rm,writeFile} from "node:fs/promises";
import {basename,dirname,join,resolve} from "node:path";
import {exportCandidatePlan,GetDeckCandidateArgsSchema,type Logger} from "@tomekin/core";
import {closeDatabase,createSqliteDeckCandidateRepository,openDatabase,resolveDatabasePath} from "@tomekin/sqlite";
const usage = "Usage: tomekin deck-candidate export-plan <id> --format json|mermaid --projection strategy|selected|pool --output <path>";
export async function runDeckCandidateExportCommand(args: readonly string[],env: {TOMEKIN_DB_PATH?:string | undefined},io: {stdout:{write(s:string):void};stderr:{write(s:string):void}},runtime:{log:Logger}): Promise<number> {
    const fail = (message:string) => {io.stderr.write(`${message}\n${usage}\n`);return 1;};
    const id=args[0];
    if (!id || !GetDeckCandidateArgsSchema.safeParse({id}).success) return fail("Supply an existing Deck Candidate UUID.");
    const flags:Record<string,string>={};
    for(let i=1;i<args.length;i+=2){
        const key=args[i]!,value=args[i+1];
        if(!["--format","--projection","--output"].includes(key) || !value || value.startsWith("--") || key in flags) return fail(`Invalid, duplicate or missing option: ${key}.`);
        flags[key]=value;
    }
    const format=flags["--format"],projection=flags["--projection"]??"strategy",output=flags["--output"];
    if(format!=="json" && format!=="mermaid")return fail("Choose --format json or mermaid.");
    if(!["strategy","selected","pool"].includes(projection))return fail("Choose --projection strategy, selected or pool.");
    if(!output)return fail("Supply --output <path>.");
    let source:string;
    try {
        const db=openDatabase(resolveDatabasePath(env),{log:runtime.log});
        try {
            const found=await createSqliteDeckCandidateRepository(db,{now:()=>new Date()}).getDeckCandidate(id);
            if(found.isErr())return fail(found.error.message);
            const exported=exportCandidatePlan(found.value,{format,projection});
            if(exported.isErr())return fail(exported.error.message);
            source=exported.value;
        }finally{closeDatabase(db);}
    }catch(error){return fail(`Could not read Deck Candidate ${id}: ${error instanceof Error?error.message:String(error)}`);}
    const destination=resolve(output),temporary=join(dirname(destination),`.${basename(destination)}.tmp-${randomUUID()}`);
    try {
        // Same-directory rename publishes a completely written file atomically; failures preserve any previous artifact.
        await writeFile(temporary,source,{flag:"wx",mode:0o600});
        await rename(temporary,destination);
    }catch(error){return fail(`Could not write ${destination}: ${error instanceof Error?error.message:String(error)}. Check the output directory and permissions.`);}
    finally{await rm(temporary,{force:true}).catch(()=>{});}
    io.stdout.write(`Wrote ${format} ${projection} inspection to ${destination}\n`);
    return 0;
}
