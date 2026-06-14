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

function isJsonWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}
