/**
 * Streams one object at a time from a Scryfall bulk-data JSON-array source.
 *
 * This parser intentionally supports only the Scryfall bulk-data shape: a
 * top-level JSON array whose items are JSON objects. It does not try to be a
 * general JSON streaming parser. Keeping the boundary this narrow lets core
 * accept any `ReadableStream<Uint8Array>` source, including local files and
 * future fetch response bodies, while avoiding the cost of generic token
 * parsers materializing large nested Scryfall fields that the importer later
 * discards.
 */
export async function* parseJsonArrayItems(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<unknown> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let startedArray = false;
  let finishedArray = false;
  let readingObject = false;
  let objectDepth = 0;
  let inString = false;
  let escaped = false;
  let objectText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });

      for (const char of chunk) {
        if (!startedArray) {
          if (isJsonWhitespace(char) || char === "\uFEFF") {
            continue;
          }
          if (char !== "[") {
            throw new Error("Expected Scryfall source to be a top-level JSON array.");
          }
          startedArray = true;
          continue;
        }

        if (finishedArray) {
          if (!isJsonWhitespace(char)) {
            throw new Error("Unexpected content after Scryfall source JSON array.");
          }
          continue;
        }

        if (!readingObject) {
          if (isJsonWhitespace(char) || char === ",") {
            continue;
          }
          if (char === "]") {
            finishedArray = true;
            continue;
          }
          if (char !== "{") {
            throw new Error("Expected Scryfall source array items to be JSON objects.");
          }
          readingObject = true;
          objectDepth = 1;
          objectText = "{";
          continue;
        }

        objectText += char;

        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\" && inString) {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) {
          continue;
        }
        if (char === "{") {
          objectDepth += 1;
          continue;
        }
        if (char === "}") {
          objectDepth -= 1;
          if (objectDepth === 0) {
            readingObject = false;
            inString = false;
            yield JSON.parse(objectText) as unknown;
            objectText = "";
          }
        }
      }

      if (done) {
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!startedArray) {
    throw new Error("Expected Scryfall source to be a top-level JSON array.");
  }
  if (readingObject) {
    throw new Error("Unexpected end of Scryfall source while reading a JSON object.");
  }
  if (!finishedArray) {
    throw new Error("Unexpected end of Scryfall source while reading the JSON array.");
  }
}

export async function* parseJsonlItems(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<unknown> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let line = "";
  let lineNumber = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = (line + chunk).split(/\r?\n/);
      line = lines.pop() ?? "";

      for (const nextLine of lines) {
        lineNumber += 1;
        const trimmed = nextLine.trim();
        if (trimmed.length === 0) continue;
        yield parseJsonlLine(trimmed, lineNumber);
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  const trimmed = line.trim();
  if (trimmed.length > 0) {
    lineNumber += 1;
    yield parseJsonlLine(trimmed, lineNumber);
  }
}

export function parseGzippedJsonlItems(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<unknown> {
  const gzip = new DecompressionStream("gzip") as unknown as ReadableWritablePair<
    Uint8Array,
    Uint8Array
  >;
  return parseJsonlItems(stream.pipeThrough(gzip));
}

export async function* parseScryfallBulkDataItems(
    stream: ReadableStream<Uint8Array>,
): AsyncIterable<unknown> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let firstNonWhitespace: string | null = null;

  while (firstNonWhitespace === null) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value);
    firstNonWhitespace = firstNonWhitespaceChar(value);

    if (chunks.length === 1 && isGzipChunk(value)) {
      yield* parseGzippedJsonlItems(replayReadChunks(reader, chunks));
      return;
    }
  }

  const replayed = replayReadChunks(reader, chunks);
  if (firstNonWhitespace === "{") {
    yield* parseJsonlItems(replayed);
    return;
  }

  yield* parseJsonArrayItems(replayed);
}

function parseJsonlLine(line: string, lineNumber: number): unknown {
  try {
    const value = JSON.parse(line) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Expected Scryfall JSONL records to be JSON objects.");
    }
    return value;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected Scryfall")) {
      throw error;
    }
    throw new Error(`Failed to parse Scryfall JSONL line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}.`);
  }
}

function replayReadChunks(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    chunks: readonly Uint8Array[],
): ReadableStream<Uint8Array> {
  let chunkIndex = 0;
  let released = false;

  function releaseReader(): void {
    if (released) return;
    released = true;
    reader.releaseLock();
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(chunks[chunkIndex]!);
        chunkIndex += 1;
        return;
      }

      try {
        const {done, value} = await reader.read();
        if (done) {
          releaseReader();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        releaseReader();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        releaseReader();
      }
    },
  });
}

function firstNonWhitespaceChar(chunk: Uint8Array): string | null {
  for (const char of new TextDecoder().decode(chunk)) {
    if (!isJsonWhitespace(char) && char !== "\uFEFF") return char;
  }
  return null;
}

function isGzipChunk(chunk: Uint8Array): boolean {
  return chunk.length >= 2 && chunk[0] === 0x1f && chunk[1] === 0x8b;
}

function isJsonWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}
