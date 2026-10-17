# Domain Docs

How engineering skills should consume this repository's domain documentation.

## Before exploring

- Read `GLOSSARY-MAP.md` at the repository root, then each `GLOSSARY.md` relevant to the work. If no map exists, read
  the root `GLOSSARY.md`.
- Read ADRs in `docs/adr/` that touch the area under consideration, and any relevant package's `docs/adr/`.
- If a glossary or ADR directory does not exist, proceed silently. `/domain-modeling` creates it only when terminology
  or a decision needs recording.

## Layout

This is a multi-context repository. `GLOSSARY-MAP.md` identifies the shared and package-specific contexts. System-wide
decisions live in `docs/adr/`; package-specific decisions may live under the relevant package when needed.

## Vocabulary and ADRs

Use glossary terms as defined in the relevant `GLOSSARY.md`; do not substitute terms the glossary explicitly avoids. If
an output contradicts an ADR, identify that conflict explicitly rather than silently overriding it.
