import {err, ok, type Result} from "neverthrow";
import {z} from "zod";

const count = z.number().int().nonnegative();
const atLeastEvent = z.strictObject({kind: z.literal("at_least"), count});
const event = z.discriminatedUnion("kind", [
    z.strictObject({kind: z.literal("exactly"), count}),
    atLeastEvent,
    z.strictObject({kind: z.literal("at_most"), count}),
    z.strictObject({kind: z.literal("between"), lower: count, upper: count})
        .refine((value) => value.lower <= value.upper, {path: ["upper"], message: "upper must be at least lower; supply an ordered inclusive interval."}),
]);
const common = {populationSize: count.max(1000), sampleSize: count};
const probabilityRequest = z.strictObject({operation: z.literal("probability"), ...common, populationSuccesses: count, event});
const targetProbability = z.string().regex(/^(?:0(?:\.[0-9]{1,18})?|1(?:\.0{1,18})?)$/, "targetProbability must be a decimal string from 0 to 1, with at most 18 fractional digits and no signs, whitespace or exponent.");
const minimumRequest = z.strictObject({operation: z.literal("minimum_successes"), ...common, event: atLeastEvent, targetProbability});
export const HypergeometricCalculatorRequestSchema = z.discriminatedUnion("operation", [probabilityRequest, minimumRequest])
    .superRefine((value, context) => {
        if (value.sampleSize > value.populationSize) context.addIssue({code: "custom", path: ["sampleSize"], message: "sampleSize must not exceed populationSize; reduce sampleSize or increase populationSize (at most 1000)."});
        if (value.operation === "probability" && value.populationSuccesses > value.populationSize) context.addIssue({code: "custom", path: ["populationSuccesses"], message: "populationSuccesses must not exceed populationSize; supply the actual qualifying count."});
    });
/** OpenCode requires a flat argument shape; conditional requirements are checked by the service. */
export const HypergeometricCalculatorArgsSchema = z.strictObject({
    operation: z.enum(["probability", "minimum_successes"]),
    ...common,
    populationSuccesses: count.optional().describe("Required only for probability; omit for minimum_successes."),
    event,
    targetProbability: targetProbability.optional().describe("Required only for minimum_successes, which supports only at_least events; omit for probability."),
}).superRefine((value, context) => {
    const result = HypergeometricCalculatorRequestSchema.safeParse(value);
    if (!result.success) for (const issue of result.error.issues) context.addIssue({code: "custom", path: issue.path, message: issue.message});
});
export type CalculatorRequest = z.infer<typeof HypergeometricCalculatorRequestSchema>;
export type CalculatorError = {readonly type: "validation_error" | "target_unattainable"; readonly message: string};
export type EventStatus = "impossible" | "certain" | "nontrivial";
type DisplayProbability = {readonly probability: number; readonly eventStatus: EventStatus};
export type CalculatorOutput = DisplayProbability & {readonly model: "uniform_without_replacement"} & (
    | {readonly request: Extract<CalculatorRequest, {operation: "probability"}>}
    | {readonly request: Extract<CalculatorRequest, {operation: "minimum_successes"}>; readonly minimumSuccesses: number; readonly previous: (DisplayProbability & {readonly populationSuccesses: number}) | null}
);

/** Exact uniform-subset weights; expected input failures remain typed Results. */
export function calculateHypergeometric(input: unknown): Result<CalculatorOutput, CalculatorError> {
    const parsed = HypergeometricCalculatorRequestSchema.safeParse(input);
    if (!parsed.success) return err({type: "validation_error", message: parsed.error.message});
    const request = parsed.data;
    const denominator = choose(request.populationSize, request.sampleSize);
    if (request.operation === "probability") {
        const numerator = eventWeight(request.populationSize, request.populationSuccesses, request.sampleSize, request.event);
        return ok({request, model: "uniform_without_replacement", ...display(numerator, denominator)});
    }
    const [integerPart, fraction = ""] = request.targetProbability.split(".");
    const target = BigInt(integerPart! + fraction);
    const scale = 10n ** BigInt(fraction.length);
    const threshold = request.event.count;
    if (threshold > request.sampleSize && target > 0n) return err({
        type: "target_unattainable",
        message: `event.count ${threshold} exceeds sampleSize ${request.sampleSize}; the at-least event is impossible for every qualifying count and cannot meet targetProbability ${request.targetProbability}. Reduce event.count, increase sampleSize within populationSize or use targetProbability "0".`,
    });
    const weightAt = (qualifying: number) => eventWeight(request.populationSize, qualifying, request.sampleSize, request.event);
    let minimum = 0;
    if (target > 0n && threshold > 0) {
        // A sample is guaranteed to contain threshold successes exactly at this support boundary.
        if (target === scale) minimum = request.populationSize - request.sampleSize + threshold;
        else {
            let failing = threshold - 1;
            let passing = request.populationSize - request.sampleSize + threshold;
            while (passing - failing > 1) {
                const middle = Math.floor((passing + failing) / 2);
                if (weightAt(middle) * scale >= target * denominator) passing = middle;
                else failing = middle;
            }
            minimum = passing;
        }
    }
    return ok({request, model: "uniform_without_replacement", minimumSuccesses: minimum,
        ...display(weightAt(minimum), denominator),
        previous: minimum === 0 ? null : {populationSuccesses: minimum - 1, ...display(weightAt(minimum - 1), denominator)},
    });
}

function choose(population: number, selected: number): bigint {
    let value = 1n;
    for (let i = 1; i <= Math.min(selected, population - selected); i++) {
        value = value * BigInt(population - i + 1) / BigInt(i);
    }
    return value;
}

function eventWeight(population: number, qualifying: number, sample: number, event: CalculatorRequest["event"]): bigint {
    const supportLower = Math.max(0, sample - (population - qualifying));
    const supportUpper = Math.min(sample, qualifying);
    const lower = Math.max(supportLower, event.kind === "between" ? event.lower : event.kind === "at_most" ? 0 : event.count);
    const upper = Math.min(supportUpper, event.kind === "between" ? event.upper : event.kind === "at_least" ? sample : event.count);
    if (lower > upper) return 0n;
    let weight = choose(qualifying, lower) * choose(population - qualifying, sample - lower);
    let total = weight;
    for (let x = lower; x < upper; x++) {
        // Multiply before dividing: the combined recurrence is exactly divisible.
        weight = weight * BigInt(qualifying - x) * BigInt(sample - x)
            / (BigInt(x + 1) * BigInt(population - qualifying - sample + x + 1));
        total += weight;
    }
    return total;
}

function display(numerator: bigint, denominator: bigint): {probability: number; eventStatus: EventStatus} {
    if (numerator === 0n) return {probability: 0, eventStatus: "impossible"};
    if (numerator === denominator) return {probability: 1, eventStatus: "certain"};
    // Counts of subsets of at most 1000 elements fit within 2^1000, hence Number.
    return {probability: Number(numerator) / Number(denominator), eventStatus: "nontrivial"};
}
