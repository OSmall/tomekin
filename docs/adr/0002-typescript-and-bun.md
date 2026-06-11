# TypeScript on Bun

The portable core and local opencode tooling will be implemented in TypeScript, with Bun treated as the first-class runtime and package manager. Bun matches the user's preferred local development workflow, provides a fast TypeScript-friendly runtime, and can be installed consistently with mise.

Node.js compatibility may be useful later for hosted deployment or ecosystem reasons, but the MVP should not treat Bun as an afterthought or require npm-based workflows by default.
