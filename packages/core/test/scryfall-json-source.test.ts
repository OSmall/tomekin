import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  parseGzippedJsonlItems,
  parseJsonArrayItems,
  parseJsonlItems,
  parseScryfallBulkDataItems
} from "@mtg-agent/core";

describe("Scryfall JSON source parser", () => {
  test("parses one top-level array item per value from a Bun file stream", async () => {
    const path = await writeTempJson([
      { id: "first" },
      { id: "second" },
      { id: "third" },
    ]);

    const items = await collect(parseJsonArrayItems(Bun.file(path).stream()));

    expect(items).toEqual([{ id: "first" }, { id: "second" }, { id: "third" }]);
  });

  test("handles nested structures, escaped strings, braces in strings, and Unicode text", async () => {
    const expected = [
      {
        id: "complex",
        nested: { array: [{ value: "{not json}" }] },
        text: "escaped \\\" quote and mana {G}",
        unicode: "Æther Gust",
      },
    ];
    const path = await writeTempJson(expected);

    const items = await collect(parseJsonArrayItems(Bun.file(path).stream()));

    expect(items).toEqual(expected);
  });

  test("fails clearly for malformed JSON", async () => {
    const path = await writeTempText("[{]");

    await expect(collect(parseJsonArrayItems(Bun.file(path).stream()))).rejects.toThrow();
  });

  test("fails clearly when the top-level value is not an array", async () => {
    const path = await writeTempText(JSON.stringify({ id: "not-array" }));

    await expect(collect(parseJsonArrayItems(Bun.file(path).stream()))).rejects.toThrow(
      "top-level JSON array",
    );
  });

  test("parses one JSONL object per line", async () => {
    const items = await collect(
      parseJsonlItems(
        new Response('{"id":"first"}\n{"id":"second"}\n').body!,
      ),
    );

    expect(items).toEqual([{ id: "first" }, { id: "second" }]);
  });

  test("parses gzipped JSONL objects", async () => {
    const stream = new Response('{"id":"first"}\n{"id":"second"}\n')
      .body!.pipeThrough(new CompressionStream("gzip"));

    const items = await collect(parseGzippedJsonlItems(stream));

      expect(items).toEqual([{id: "first"}, {id: "second"}]);
  });

    test("bulk data parser accepts Scryfall uncompressed JSON array downloads", async () => {
        const items = await collect(
            parseScryfallBulkDataItems(
                new Response('[{"id":"first"},{"id":"second"}]').body!,
            ),
        );

        expect(items).toEqual([{id: "first"}, {id: "second"}]);
    });

    test("bulk data parser accepts gzipped JSONL downloads", async () => {
        const stream = new Response('{"id":"first"}\n{"id":"second"}\n')
            .body!.pipeThrough(new CompressionStream("gzip"));

        const items = await collect(parseScryfallBulkDataItems(stream));

    expect(items).toEqual([{ id: "first" }, { id: "second" }]);
  });

  test("JSONL parser rejects non-object records", async () => {
    await expect(collect(parseJsonlItems(new Response('[1,2,3]\n').body!))).rejects.toThrow(
      "JSON objects",
    );
  });
});

async function writeTempJson(value: unknown): Promise<string> {
  return writeTempText(JSON.stringify(value));
}

async function writeTempText(text: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "mtg-agent-json-source-"));
  const path = join(dir, "source.json");
  await Bun.write(path, text);
  return path;
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const collected: T[] = [];
  for await (const item of items) {
    collected.push(item);
  }
  return collected;
}
