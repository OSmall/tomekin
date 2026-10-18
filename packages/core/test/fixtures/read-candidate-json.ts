/** Consumer-side reconstruction through the public bounded view, shared by persistence/transport tests. */
export async function readCandidateJson(read: (input: any) => Promise<any>, id: string): Promise<any> {
    let restored: any, after: string | undefined;
    do {
        const result = await read({id, view:"json", first:200, ...(after ? {after} : {})});
        const page = typeof result.isErr === "function" ? (result.isErr() ? (()=>{throw new Error(JSON.stringify(result.error));})() : result.value) : result;
        if(page.status !== "ok") throw new Error(JSON.stringify(page.error));
        for(const {node:{path,value}} of page.edges) {
            if(!path.length) {restored=value;continue;}
            let parent=restored;
            for(const key of path.slice(0,-1)) parent=parent[key];
            parent[path.at(-1)]=value;
        }
        after=page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined;
    } while(after);
    return restored;
}
