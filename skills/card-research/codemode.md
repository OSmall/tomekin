# Pi codemode: bounded traversal and recovery

Pi's `codemode` accepts raw JavaScript, and `tools.<name>(args)` invokes the same approved tools as direct calls. Tomekin tool results are JSON strings: parse them before examining `next_cursor`, `status`, or `error`. The sandbox has no general filesystem, network, shell, or model calls. Keep direct calls for decisions between calls.

For a traversal, save the exact fixed request and the real delivered cursor together using `store(key, value)`; use `load(key)` in a later script or after reopening the same Pi session. A successful script commits its store writes to the session branch only when its output fits. A failed, cancelled, or truncated script does not commit its writes; use the last committed checkpoint. Do not assume a temporary variable persists. A printed real cursor and fixed input are also portable recovery values. Other sessions do not share the store.

Keep output comfortably below the outer limit. Request small pages, print every needed fact and the real continuation or error recovery position, and stop the script before accumulating more output than can fit. For one complete Tomekin envelope, use an appropriate `max_output_tokens` option (for example 30000) and avoid accumulating many pages. The core's whole-envelope limit still applies. If Pi reports truncation, the result is incomplete and its checkpoint was not committed: repeat from the prior checkpoint with less output, not the inaccessible temporary file. A failed script can have made real calls. If a mutation or check publication was dispatched and its outcome is unknown, inspect saved state before retrying.

Example for a single successful page, where `fixed` is a valid request assembled from the actual tool schema:

```js
// @options: {"max_output_tokens": 30000}
const previous = load("research") ?? { fixed, cursor: null, complete: false };
if (previous.complete) {
  text("This traversal is already complete.");
} else {
  const request = previous.cursor === null ? previous.fixed : { ...previous.fixed, after: previous.cursor };
  const page = JSON.parse(await tools.search_cards(request));
  text(JSON.stringify(page));
  if (page.status !== "error") {
    store("research", { fixed: previous.fixed, cursor: page.next_cursor, complete: page.next_cursor === null });
  }
}
```

Define `fixed` in the first script, then use only the loaded checkpoint on subsequent calls. A null cursor means exhaustion, so do not restart an already completed traversal unintentionally. For partial/error responses retain and report all delivered facts and the provided safe `error.cursor`; when none is supplied retry from the prior committed position. Changed query, scope, policy, or relevant baseline must follow the tool's restart/reconfirmation response; do not splice pages from incompatible requests. Do not claim completion before `next_cursor` is null and all required output has been delivered.
