# Pi-native Tomekin skills

Status: accepted; the skill names and partition below are superseded by the five-skill architecture in [the current architecture](../architecture.md#workflow-instruction-boundary).

Pi explicitly discovers Tomekin's canonical `skills/` directory as native skills while ambient discovery remains
disabled. Its model may read only real, regular working-tree files beneath that directory through a constrained `read`
replacement. The root `tomekin-deck-building` skill supplies Tomekin's product workflow and routes to the supporting
skills, so both Pi and OpenCode use one product-instruction tree without gaining general filesystem or Git authority.

The current shared method is `deck-shape-methodology`; root, discovery and Format architecture/tuning skills compose
it. Format owners hold executable sampling examples and contextual templates. The integration audit loads actual Pi
restricted reads and verifies OpenCode's canonical native-skill targets and allowed tool exports. This source-routing
proof is distinct from a live model following the workflow. The original OpenCode-first delivery order in ADR 0001
is historical; both supported adapters consume the same product instructions and tools.
