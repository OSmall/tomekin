type AdapterInputSchema = {_zod: {toJSONSchema?: () => unknown; parent?: unknown}};
type CanonicalInputValidator = {safeParse(input: unknown): {success: boolean}};

/**
 * Preserve a canonical input schema across independent host/plugin metadata registries.
 * Both supported Zod converters declare and honor the schema-local toJSONSchema override.
 * Build a fresh custom schema: clone-parent metadata chains are converter-specific.
 */
export function createCanonicalOpenCodeInputSchema<Schema extends AdapterInputSchema>(
    canonical: CanonicalInputValidator,
    canonicalJsonSchema: unknown,
    createFreshSchema: (validate: (input: unknown) => boolean) => Schema,
): Schema {
    const schema = createFreshSchema((input) => canonical.safeParse(input).success);
    if (schema._zod.parent) throw new Error("Canonical OpenCode conversion requires a fresh adapter schema.");
    schema._zod.toJSONSchema = () => structuredClone(canonicalJsonSchema);
    return schema;
}
