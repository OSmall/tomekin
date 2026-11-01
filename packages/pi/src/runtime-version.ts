/** Exact, reviewed dependency version; kept in sync with package.json by the launcher tests. */
export const supportedPiVersion = "1.4.0";

export function assertPiVersion(actual: string): void {
    if (actual !== supportedPiVersion) {
        throw new Error(`Tomekin requires Pi ${supportedPiVersion}, but found ${actual}. Run bun install --frozen-lockfile from the repository root.`);
    }
}
