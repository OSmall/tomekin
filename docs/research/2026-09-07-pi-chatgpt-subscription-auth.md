# Pi / ChatGPT subscription-authentication findings

**Question.** Can a future Tomekin-hosted Pi session use a user's ChatGPT subscription rather than an OpenAI API key,
while supporting normal login, recovery, session continuation, model/thinking controls, and Tomekin's Bun runtime?

**Investigated:** 2026-09-07. This is planning evidence only: it neither starts Pi nor authenticates an account, writes
credentials, or makes a model request.

## Result

**Conditional go for a subscription-auth design.** Pi's current first-party documentation explicitly presents ChatGPT
Plus/Pro (Codex) as a subscription provider, selected through `/login`, separate from API-key providers. Pi stores OAuth
credentials locally, refreshes expired OAuth tokens automatically, and provides a Pi-specific `/logout`. Its session,
model, and thinking controls cover the requested user-facing controls.

The proposed adapter must delegate sign-in and disconnect to Pi's supported flows, never request, copy, log, or persist
OAuth tokens itself. The evidence does **not** validate a live Tomekin request under a particular ChatGPT plan or
account: that requires a later, explicitly consented acceptance test with a real eligible account. Keep that as an
implementation acceptance criterion rather than treating documentation as an entitlement guarantee.

## Findings

### Subscription login is distinct from an API key

Pi's quickstart says `/login` can use subscription providers and names **ChatGPT Plus/Pro (Codex)** among its built-in
subscription logins; it describes API-key authentication separately through environment variables or the auth file. Its
provider reference identifies the ChatGPT/Codex flow as OAuth and says Plus or Pro is required. This supports a
no-user-supplied-API-key flow, but not a claim that every ChatGPT account is
eligible. [Pi quickstart](https://pi.dev/docs/latest/quickstart), [Pi providers](https://pi.dev/docs/latest/providers)

The current Pi implementation labels this provider `OpenAI (ChatGPT Plus/Pro)`, marks it as a subscription provider, and
offers browser PKCE login or device-code login. The latter is the viable interaction when the local Pi host has no
browser; both flows remain user-mediated and must not be automated with account
credentials. [Pi OpenAI Codex OAuth source](https://github.com/earendil-works/pi/blob/main/packages/ai/src/auth/oauth/openai-codex.ts)

### Authentication lifecycle and recovery boundary

Pi documents OAuth tokens in `~/.pi/agent/auth.json`, automatic refresh on expiry, and `/logout` to clear credentials.
The source confirms the credential contains access, refresh, and expiry values; it serializes refresh so concurrent
requests do not race a rotated token, preserves a stored credential after refresh failure for retry, and exposes a
provider-specific logout deletion operation. Therefore, a Tomekin integration should use Pi's credential store and
present a **Pi disconnect/re-login** recovery action; it should not read or manipulate that
file. [Pi providers](https://pi.dev/docs/latest/providers), [Pi credential types](https://github.com/earendil-works/pi/blob/main/packages/ai/src/auth/types.ts), [Pi model/auth lifecycle](https://github.com/earendil-works/pi/blob/main/packages/ai/src/models.ts)

OpenAI's account-recovery guidance is relevant to the human account: users must generally use the original sign-in
method, and recovery may require another configured factor. But OpenAI explicitly says ChatGPT's Active Sessions
controls do **not** manage third-party or Codex CLI authorization. Thus logging out of the ChatGPT website cannot be
offered as Pi token revocation; Pi `/logout` is the local-control path, while OpenAI account recovery/session controls
remain a separate user-directed
contingency. [OpenAI login guidance](https://help.openai.com/en/articles/7426629-why-cant-i-log-in-to-chatgpt), [OpenAI MFA recovery](https://help.openai.com/en/articles/7967234), [OpenAI Active Sessions](https://help.openai.com/en/articles/20001257-managing-active-sessions-in-chatgpt)

### Resume and user controls

Pi saves sessions automatically. `pi -c` continues the most recent session, `pi -r` selects a prior session, and
`/resume` is available in the interactive UI. These are conversation-session controls, independent of whether stored
OAuth remains valid; a resume can still need token refresh or
re-login. [Pi quickstart](https://pi.dev/docs/latest/quickstart), [Pi usage](https://pi.dev/docs/latest/usage)

Pi provides `/model` for the active model and `/thinking` for the active thinking level. The quickstart documents saving
startup defaults from either picker; the CLI accepts `--model`, including a `:<thinking>` suffix, and `--thinking`
values from `off` through `max`. Actual exposed thinking levels are model-dependent, so a Tomekin surface should query
Pi's available model/thinking controls rather than hard-code a
list. [Pi quickstart](https://pi.dev/docs/latest/quickstart), [Pi usage](https://pi.dev/docs/latest/usage), [Pi RPC controls](https://pi.dev/docs/latest/rpc), [Pi model configuration](https://pi.dev/docs/latest/models)

### Bun-hosted feasibility

Pi's quickstart explicitly documents Bun as a supported package-manager route (`bun uninstall -g` in its install
lifecycle), but it does not promise broad Bun runtime support. The current Pi OAuth source conditionally loads
`node:crypto` and `node:http` when `process.versions.bun` is present, which is positive implementation evidence for the
browser callback path under
Bun. [Pi quickstart](https://pi.dev/docs/latest/quickstart), [Pi OpenAI Codex OAuth source](https://github.com/earendil-works/pi/blob/main/packages/ai/src/auth/oauth/openai-codex.ts)

Locally, `bun --version` returned **1.3.14** and `node --version` returned **v26.4.0**. The
companion [Pi / Bun compatibility findings](./2026-09-07-pi-bun-compatibility.md) records an isolated Bun 1.3.14 probe
that constructed a Pi in-memory session beside Tomekin's core and SQLite packages without a provider request. Together
this justifies an in-process Bun prototype, not production support certainty. The acceptance test must exercise browser
and device-code login as applicable, a subscribed authenticated request, persisted-session resume after restart,
forced/expired-token refresh, logout, and failed-refresh re-login.

## Planning implications

- Keep subscription login an interactive local-Pi concern; Tomekin supplies no API-key field and owns no credential
  material.
- Make the local credential/session location, permission model, and whether an existing user-wide Pi identity may be
  reused an explicit design decision before implementation.
- Define recovery as observable states (not logged in, login cancelled, refresh failed/re-login required, logged out),
  without displaying provider error bodies or token data.
- Keep model and thinking selection capability-driven and persist only non-secret preferences that the planned boundary
  assigns to Tomekin.
- Do not conflate OpenAI's **Sign in with ChatGPT** product with Pi's subscription OAuth: OpenAI documents that the
  former normally shares profile information, not ChatGPT conversations, files, tokens, or
  billing. [OpenAI Sign in with ChatGPT](https://help.openai.com/en/articles/20001410-sign-in-with-chatgpt)

## Evidence limits

No `/login`, token refresh, `/logout`, or completion was invoked during this research, and no token or account data was
inspected. Pi's documentation and source are current primary-source evidence, but provider availability, plan
eligibility, and quota behavior can change. The planned real-account verification should be opt-in, local, and must
confirm the exact supported Pi version plus the user's plan at that time.
