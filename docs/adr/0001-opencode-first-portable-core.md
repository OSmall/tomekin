# Opencode-first MVP with a portable core

The MVP will be delivered first as a set of local opencode tools, agents, and skills so it can be implemented quickly and use the user's existing ChatGPT subscription for LLM access. The MTG collection and deck-building logic must live in a portable core that is not coupled to opencode, local files, or a chat-only workflow, so the same domain capabilities can later be reused by a web-based, multi-user hosted product.

This chooses a fast local agent surface now while explicitly rejecting an architecture where product logic is embedded directly inside opencode prompts, skills, or tool glue.
