# Todos

Authored and edited only by osmall, not agents.

## List

- Improve logging. Add a logging framework and make it robust.
  - It is not yet robust. It's a bit spaghetti. Especially with the logging within tests that use env variables to print
    them to the right place. More thought needs to go into this.
- Pin versions of dependencies.
- figure out schema.ts ```.default(sql`'[]'`)```
- use T3.env for environment variables
- explore defined roles on DeckCandidateCard e.g. "payoff" or "enabler"
- refine agent and skills to follow better deck building practices
- scryfall import from remote
- add timeout to card query
- make `mtg-agent_save_deck_candidate` quicker
- prevent portable decklist from printing in deck_candidate.markdown
- add a way to save user context about how to handle the collection
  - e.g. Don't use the collection-stored basic lands when building decks. Pretend there is an infinite supply of basic
    lands.
- Make better use of .jsonl Scryfall files i.e. stream them to save memory