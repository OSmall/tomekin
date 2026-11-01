import {cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {execFileSync} from "node:child_process";

// Run the same rich workload against the actual pinned source, never a reconstructed legacy envelope.
export const economyBaselineReference = "d16556954a10443e5e207a032dfe75e3e88dd377";
const root = resolve(import.meta.dir,"../../..");
export async function withEconomyBaseline<T>(run: (directory:string)=>Promise<T>):Promise<T> {
const directory = mkdtempSync(join(tmpdir(),"tomekin-economy-baseline-"));
try {
    execFileSync("tar",["-x","-C",directory],{input:execFileSync("git",["archive",economyBaselineReference],{cwd:root,maxBuffer:30_000_000})});
    mkdirSync(join(directory,"node_modules"));
    symlinkSync(join(root,"node_modules/.bun"),join(directory,"node_modules/.bun"));
    for(const pkg of readdirSync(join(root,"packages"))) {
        const modules=join(root,"packages",pkg,"node_modules");
        try {cpSync(modules,join(directory,"packages",pkg,"node_modules"),{recursive:true,verbatimSymlinks:true});} catch(error) {if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error;}
    }
    return await run(directory);
} finally {rmSync(directory,{recursive:true,force:true});}
}

if(import.meta.main) await withEconomyBaseline(async directory=>{
    cpSync(join(root,"packages/evaluation/src/economy.ts"),join(directory,"packages/evaluation/src/economy.ts"));
    const report=JSON.parse(execFileSync(process.execPath,[join(directory,"packages/evaluation/src/economy.ts"),"--rich"],{cwd:directory,env:{...process.env,TOMEKIN_LOG_ENABLED:"false"},encoding:"utf8",maxBuffer:5_000_000}));
    writeFileSync(join(root,"packages/evaluation/src/economy-baseline.json"),JSON.stringify({sourceRevision:economyBaselineReference,...report},null,2)+"\n");
    console.log("Recorded matched pre-change economy baseline.");
});
