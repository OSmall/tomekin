import {expect, test} from "bun:test";
import {calculateHypergeometric} from "@tomekin/core";

test("calculates the inclusive event from the normative small distribution", () => {
    const result = calculateHypergeometric({operation: "probability", populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "between", lower: 1, upper: 2}});
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value).toEqual({request: {operation: "probability", populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "between", lower: 1, upper: 2}}, model: "uniform_without_replacement", probability: 5 / 6, eventStatus: "nontrivial"});
});

test("finds the first passing qualifying count using exact decimal equality", () => {
    const result = calculateHypergeometric({operation: "minimum_successes", populationSize: 5, sampleSize: 2, event: {kind: "at_least", count: 1}, targetProbability: "0.70"});
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value).toMatchObject({minimumSuccesses: 2, probability: 0.7, eventStatus: "nontrivial", previous: {populationSuccesses: 1, probability: 0.4, eventStatus: "nontrivial"}});
});

// An independent oracle enumerates uniformly sampled subsets, with no binomial recurrence.
function subsetCounts(population: number, qualifying: number, sample: number): number[] {
    const counts = Array<number>(sample + 1).fill(0);
    for (let subset = 0; subset < 2 ** population; subset++) {
        let selected = 0;
        let successes = 0;
        for (let label = 0; label < population; label++) if ((subset & (1 << label)) !== 0) {
            selected++;
            if (label < qualifying) successes++;
        }
        if (selected === sample) counts[successes]!++;
    }
    return counts;
}

function probability(populationSize: number, populationSuccesses: number, sampleSize: number, event: Record<string, unknown>) {
    const result = calculateHypergeometric({operation: "probability", populationSize, populationSuccesses, sampleSize, event});
    if (result.isErr()) throw new Error(result.error.message);
    return result.value;
}

function assertFraction(actual: {probability: number; eventStatus: string}, numerator: number | bigint, denominator: number | bigint) {
    const top = BigInt(numerator);
    const bottom = BigInt(denominator);
    expect(actual.eventStatus).toBe(top === 0n ? "impossible" : top === bottom ? "certain" : "nontrivial");
    if (top === 0n) expect(actual.probability).toBe(0);
    else {
        // Independently round a decimal expansion with at least 35 significant digits.
        const decimalPlaces = 35 + Math.max(0, bottom.toString().length - top.toString().length);
        const digits = top * 10n ** BigInt(decimalPlaces) / bottom;
        const oracle = Number(`${digits}e-${decimalPlaces}`);
        expect(actual.probability).toBeGreaterThan(0);
        expect(Math.abs(actual.probability / oracle - 1)).toBeLessThanOrEqual(1e-12);
        if (top === bottom) expect(actual.probability).toBe(1);
    }
}

test("matches subset enumeration for every small population, inclusive event and support boundary", () => {
    for (let population = 0; population <= 8; population++) for (let sample = 0; sample <= population; sample++) for (let qualifying = 0; qualifying <= population; qualifying++) {
        const counts = subsetCounts(population, qualifying, sample);
        const denominator = counts.reduce((sum, count) => sum + count, 0);
        for (let cutoff = 0; cutoff <= sample + 1; cutoff++) {
            assertFraction(probability(population, qualifying, sample, {kind: "exactly", count: cutoff}), counts[cutoff] ?? 0, denominator);
            assertFraction(probability(population, qualifying, sample, {kind: "at_least", count: cutoff}), counts.slice(cutoff).reduce((sum, count) => sum + count, 0), denominator);
            assertFraction(probability(population, qualifying, sample, {kind: "at_most", count: cutoff}), counts.slice(0, cutoff + 1).reduce((sum, count) => sum + count, 0), denominator);
            for (let upper = cutoff; upper <= sample + 1; upper++) assertFraction(probability(population, qualifying, sample, {kind: "between", lower: cutoff, upper}), counts.slice(cutoff, upper + 1).reduce((sum, count) => sum + count, 0), denominator);
        }
        const masses = counts.map((_, cutoff) => probability(population, qualifying, sample, {kind: "exactly", count: cutoff}).probability);
        expect(masses.reduce((sum, mass) => sum + mass, 0)).toBeCloseTo(1, 14);
    }
});

// Direct factorial ratios and a linear scan differ from production's recurrences/binary search.
const factorials = [1n];
for (let value = 1; value <= 1000; value++) factorials.push(factorials[value - 1]! * BigInt(value));
function binomial(population: number, selected: number): bigint {
    if (selected < 0 || selected > population) return 0n;
    return factorials[population]! / (factorials[selected]! * factorials[population - selected]!);
}
function oracleTail(population: number, qualifying: number, sample: number, cutoff: number): bigint {
    let sum = 0n;
    for (let observed = cutoff; observed <= sample; observed++) sum += binomial(qualifying, observed) * binomial(population - qualifying, sample - observed);
    return sum;
}

test("minimum counts, adjacent evidence and monotone tails match an independent exact linear scan", () => {
    const targets = [["0", 0n, 1n], ["0.1", 1n, 10n], ["0.50", 1n, 2n], ["0.70", 7n, 10n], ["0.9", 9n, 10n], ["1.000", 1n, 1n]] as const;
    for (let population = 0; population <= 12; population++) for (let sample = 0; sample <= population; sample++) for (let cutoff = 0; cutoff <= sample + 1; cutoff++) {
        const denominator = binomial(population, sample);
        const numerators = Array.from({length: population + 1}, (_, qualifying) => oracleTail(population, qualifying, sample, cutoff));
        for (let qualifying = 1; qualifying <= population; qualifying++) expect(numerators[qualifying]!).toBeGreaterThanOrEqual(numerators[qualifying - 1]!);
        for (const [targetProbability, top, bottom] of targets) {
            const minimum = numerators.findIndex((weight) => weight * bottom >= top * denominator);
            const result = calculateHypergeometric({operation: "minimum_successes", populationSize: population, sampleSize: sample, event: {kind: "at_least", count: cutoff}, targetProbability});
            if (minimum === -1) {
                expect(result.isErr() && result.error.type).toBe("target_unattainable");
                continue;
            }
            if (result.isErr()) throw new Error(result.error.message);
            if (!("minimumSuccesses" in result.value)) throw new Error("Expected minimum-count result");
            expect(result.value.minimumSuccesses).toBe(minimum);
            assertFraction(result.value, numerators[minimum]!, denominator);
            if (minimum === 0) expect(result.value.previous).toBeNull();
            else {
                expect(result.value.previous!.populationSuccesses).toBe(minimum - 1);
                assertFraction(result.value.previous!, numerators[minimum - 1]!, denominator);
                expect(numerators[minimum - 1]! * bottom < top * denominator).toBe(true);
            }
        }
    }
});

test("preserves positivity, exact status and relative accuracy at the maximum population", () => {
    for (const [qualifying, sample, cutoff] of [[500, 500, 500], [500, 500, 0], [500, 500, 250], [999, 500, 500], [1, 500, 1], [400, 600, 1]] as const) {
        const denominator = binomial(1000, sample);
        const exact = binomial(qualifying, cutoff) * binomial(1000 - qualifying, sample - cutoff);
        assertFraction(probability(1000, qualifying, sample, {kind: "exactly", count: cutoff}), exact, denominator);
        const tail = oracleTail(1000, qualifying, sample, cutoff);
        assertFraction(probability(1000, qualifying, sample, {kind: "at_least", count: cutoff}), tail, denominator);
        const complement = probability(1000, qualifying, sample, {kind: "at_most", count: cutoff - (cutoff > 0 ? 1 : 0)});
        if (cutoff > 0) expect(probability(1000, qualifying, sample, {kind: "at_least", count: cutoff}).probability + complement.probability).toBeCloseTo(1, 14);
    }
    // An event may display 1 while its exact status remains nontrivial.
    expect(probability(1000, 500, 500, {kind: "at_least", count: 1})).toMatchObject({probability: 1, eventStatus: "nontrivial"});
});

test("distinguishes near-certainty from target one and exercises maximum search workloads", () => {
    const cases = [[99, 10, 1, "0.70"], [99, 10, 2, "1"], [1000, 500, 250, "0.70"], [1000, 500, 250, "0.999999999999999999"], [1000, 500, 250, "1.000"], [1000, 1000, 1000, "1"], [1000, 0, 0, "1"]] as const;
    for (const [populationSize, sampleSize, cutoff, targetProbability] of cases) {
        const result = calculateHypergeometric({operation: "minimum_successes", populationSize, sampleSize, event: {kind: "at_least", count: cutoff}, targetProbability});
        if (result.isErr()) throw new Error(result.error.message);
        if (!("minimumSuccesses" in result.value)) throw new Error("Expected minimum-count result");
        const [integer, fraction = ""] = targetProbability.split(".");
        const target = BigInt(integer! + fraction);
        const scale = 10n ** BigInt(fraction.length);
        const denominator = binomial(populationSize, sampleSize);
        const actual = oracleTail(populationSize, result.value.minimumSuccesses, sampleSize, cutoff);
        expect(actual * scale >= target * denominator).toBe(true);
        assertFraction(result.value, actual, denominator);
        if (result.value.minimumSuccesses > 0) {
            const previous = oracleTail(populationSize, result.value.minimumSuccesses - 1, sampleSize, cutoff);
            expect(previous * scale < target * denominator).toBe(true);
            assertFraction(result.value.previous!, previous, denominator);
        }
        if (target === scale && cutoff > 0) expect(result.value.minimumSuccesses).toBe(populationSize - sampleSize + cutoff);
        if (populationSize === 99 && cutoff === 1) expect(result.value.minimumSuccesses).toBe(11);
        if (populationSize === 99 && cutoff === 2) expect(result.value.minimumSuccesses).toBe(91);
    }
});

test("rejects malformed requests strictly without count coercion, defaults or discarded properties", () => {
    const valid = {operation: "probability", populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "exactly", count: 1}};
    const invalid: unknown[] = [null, [], {}, {...valid, extra: true}, {...valid, operation: "cdf"}, {...valid, targetProbability: "0.7"}, {...valid, populationSize: 1001}, {...valid, sampleSize: 5}, {...valid, populationSuccesses: 5}, {...valid, event: {kind: "between", lower: 2, upper: 1}}, {...valid, event: {kind: "exactly", count: 1, extra: true}}, {...valid, event: {kind: "exactly"}}, {...valid, event: {kind: "between", lower: 0}}, {...valid, event: {kind: "unknown", count: 0}}];
    for (const field of ["populationSize", "populationSuccesses", "sampleSize"] as const) {
        const missing = {...valid} as Record<string, unknown>;
        delete missing[field];
        invalid.push(missing);
        for (const value of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "2", null]) invalid.push({...valid, [field]: value});
    }
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"]) invalid.push({...valid, event: {kind: "exactly", count: value}});
    const minimum = {operation: "minimum_successes", populationSize: 4, sampleSize: 2, event: {kind: "at_least", count: 1}, targetProbability: "0.7"};
    invalid.push({...minimum, populationSuccesses: 1});
    for (const kind of ["exactly", "at_most", "between"]) invalid.push({...minimum, event: {kind, count: 1, lower: 0, upper: 1}});
    for (const value of [undefined, 0.7, "", ".7", "00.7", "01", "0.", "1.", "1.1", "2", "-0", "+0.7", " 0.7", "0.7 ", "7e-1", "70%", "0.1234567890123456789", "1.0000000000000000000", "0.7\n"]) invalid.push({...minimum, targetProbability: value});
    for (const input of invalid) {
        const result = calculateHypergeometric(input);
        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error(`Expected invalid input: ${JSON.stringify(input)}`);
        expect(result.error.type).toBe("validation_error");
        expect(result.error.message.length).toBeGreaterThan(0);
    }
});

test("retains ordinary zero/one and safe out-of-support event semantics", () => {
    const largest = Number.MAX_SAFE_INTEGER;
    for (const [population, qualifying, sample, observed] of [[0, 0, 0, 0], [10, 4, 0, 0], [10, 0, 5, 0], [10, 10, 5, 5], [10, 4, 10, 4]] as const) {
        expect(probability(population, qualifying, sample, {kind: "exactly", count: observed})).toMatchObject({probability: 1, eventStatus: "certain"});
        expect(probability(population, qualifying, sample, {kind: "exactly", count: largest})).toMatchObject({probability: 0, eventStatus: "impossible"});
        expect(probability(population, qualifying, sample, {kind: "at_most", count: largest})).toMatchObject({probability: 1, eventStatus: "certain"});
        expect(probability(population, qualifying, sample, {kind: "between", lower: 0, upper: largest})).toMatchObject({probability: 1, eventStatus: "certain"});
    }
    for (const targetProbability of ["0", "0.000000000000000000"]) {
        const result = calculateHypergeometric({operation: "minimum_successes", populationSize: 0, sampleSize: 0, event: {kind: "at_least", count: largest}, targetProbability});
        expect(result.isOk() && result.value).toMatchObject({minimumSuccesses: 0, probability: 0, eventStatus: "impossible", previous: null});
    }
    const impossible = calculateHypergeometric({operation: "minimum_successes", populationSize: 0, sampleSize: 0, event: {kind: "at_least", count: 1}, targetProbability: "0.000000000000000001"});
    expect(impossible.isErr() && impossible.error).toMatchObject({type: "target_unattainable", message: expect.stringContaining("sampleSize 0")});
});
