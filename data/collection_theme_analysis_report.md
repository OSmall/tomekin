# Collection Theme Analysis Report

Generated from `data/collection_theme_dataset.json`.

## Methodology
- Source dataset: `data/collection_theme_dataset.json` (1233 classified Oracle cards, 0 quarantined, 55 basic lands excluded from tagging).
- Cards are already deduped to Oracle gameplay identity; quantities remain attached separately via `quantity_total`, `quantity_in_binders`, and `quantity_in_decks`.
- Per-theme card contribution uses `power_score * (strength / 3) * confidence * primary_weight`, with `primary_weight = 1.0` and secondary themes discounted to `0.7`.
- `power_score` is a log-scaled inversion of `edhrec_rank`, normalized against the collection's worst rank (30988), then clamped to keep fringe cards from going to zero.
- Quantity contributes sublinearly via `sqrt(quantity)` so four copies matter more than one copy without overwhelming distinct-card breadth.
- Single-theme buildability blends weighted quality, breadth, binder-ready mass, availability ratio, primary-theme concentration, role balance, and best 1-3 color shell cohesion.
- 2-theme shell scores combine total shared support, true same-card overlap, overlap breadth, binder availability, and best common 1-3 color shell.
- EDHREC rank is treated as a heuristic proxy for card quality/playability, not a format gate or absolute truth.

## Strongest Single Themes

These are the best overall deck seeds when quality, breadth, copies, binder availability, and color cohesion are considered together.

### 1. spot removal
- Category: interaction
- Overall buildability: 89.4 | Binder-ready: 88.2
- Depth: 144 Oracle cards | 248 copies owned | 247 in binders | 1 in decks
- Structure: 87% primary concentration | 100% binder availability | 68% color cohesion via mardu
- Representative cards: Feed the Swarm, Banishing Light, Flames of the Firebrand

### 2. auras
- Category: enchantments
- Overall buildability: 75.5 | Binder-ready: 79.0
- Depth: 101 Oracle cards | 186 copies owned | 186 in binders | 0 in decks
- Structure: 90% primary concentration | 100% binder availability | 71% color cohesion via mardu
- Representative cards: Mortal Obstinacy, Heliod's Pilgrim, Dragon Mantle

### 3. combat tricks
- Category: interaction
- Overall buildability: 71.9 | Binder-ready: 75.3
- Depth: 115 Oracle cards | 186 copies owned | 186 in binders | 0 in decks
- Structure: 81% primary concentration | 100% binder availability | 71% color cohesion via naya
- Representative cards: Titanic Growth, Temur Battle Rage, Gaea's Gift

### 4. aggro
- Category: combat / aggressive creatures
- Overall buildability: 69.9 | Binder-ready: 75.5
- Depth: 154 Oracle cards | 253 copies owned | 253 in binders | 0 in decks
- Structure: 70% primary concentration | 100% binder availability | 79% color cohesion via mardu
- Representative cards: Order // Chaos, Oreskos Swiftclaw, Foundry Street Denizen

### 5. +1/+1 counters
- Category: counters
- Overall buildability: 66.5 | Binder-ready: 69.8
- Depth: 113 Oracle cards | 173 copies owned | 166 in binders | 7 in decks
- Structure: 66% primary concentration | 96% binder availability | 73% color cohesion via bant
- Representative cards: Inspiring Call, Rosie Cotton of South Lane, Elite Scaleguard

### 6. fliers
- Category: evasive creatures
- Overall buildability: 62.6 | Binder-ready: 68.5
- Depth: 121 Oracle cards | 197 copies owned | 192 in binders | 5 in decks
- Structure: 67% primary concentration | 97% binder availability | 73% color cohesion via esper
- Representative cards: Stormfront Pegasus, Serra Angel, Leonin Skyhunter

### 7. artifacts
- Category: artifacts
- Overall buildability: 59.9 | Binder-ready: 66.2
- Depth: 95 Oracle cards | 165 copies owned | 164 in binders | 1 in decks
- Structure: 70% primary concentration | 99% binder availability | 78% color cohesion via bant
- Representative cards: Golem Foundry, Myr Sire, Mind Stone

### 8. card draw
- Category: interaction
- Overall buildability: 59.6 | Binder-ready: 63.8
- Depth: 85 Oracle cards | 119 copies owned | 116 in binders | 3 in decks
- Structure: 69% primary concentration | 97% binder availability | 75% color cohesion via sultai
- Representative cards: Sign in Blood, Read the Bones, Divination

### 9. mana fixing
- Category: mana
- Overall buildability: 57.9 | Binder-ready: 62.2
- Depth: 51 Oracle cards | 81 copies owned | 79 in binders | 2 in decks
- Structure: 85% primary concentration | 98% binder availability | 63% color cohesion via temur
- Representative cards: Evolving Wilds, Terramorphic Expanse, Shivan Reef

### 10. tokens
- Category: tokens
- Overall buildability: 57.5 | Binder-ready: 63.4
- Depth: 77 Oracle cards | 110 copies owned | 107 in binders | 3 in decks
- Structure: 67% primary concentration | 97% binder availability | 77% color cohesion via naya
- Representative cards: Evangel of Heliod, Peregrin Took, Howl of the Night Pack

### 11. control
- Category: interaction
- Overall buildability: 56.0 | Binder-ready: 60.7
- Depth: 97 Oracle cards | 140 copies owned | 133 in binders | 7 in decks
- Structure: 76% primary concentration | 95% binder availability | 76% color cohesion via esper
- Representative cards: Negate, Cancel, Mass Calcify

### 12. lifegain
- Category: lifegain
- Overall buildability: 54.9 | Binder-ready: 61.5
- Depth: 88 Oracle cards | 165 copies owned | 162 in binders | 3 in decks
- Structure: 63% primary concentration | 98% binder availability | 82% color cohesion via abzan
- Representative cards: Soulmender, Child of Night, Nyx-Fleece Ram

### Full Theme Table

| Rank | Theme | Category | Score | Binder | Cards | Copies | Binder Copies | Deck Copies | Primary | Best Shell | Representative Cards |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1 | spot removal | interaction | 89.4 | 88.2 | 144 | 248 | 247 | 1 | 87% | mardu | Feed the Swarm, Banishing Light, Flames of the Firebrand |
| 2 | auras | enchantments | 75.5 | 79.0 | 101 | 186 | 186 | 0 | 90% | mardu | Mortal Obstinacy, Heliod's Pilgrim, Dragon Mantle |
| 3 | combat tricks | interaction | 71.9 | 75.3 | 115 | 186 | 186 | 0 | 81% | naya | Titanic Growth, Temur Battle Rage, Gaea's Gift |
| 4 | aggro | combat / aggressive creatures | 69.9 | 75.5 | 154 | 253 | 253 | 0 | 70% | mardu | Order // Chaos, Oreskos Swiftclaw, Foundry Street Denizen |
| 5 | +1/+1 counters | counters | 66.5 | 69.8 | 113 | 173 | 166 | 7 | 66% | bant | Inspiring Call, Rosie Cotton of South Lane, Elite Scaleguard |
| 6 | fliers | evasive creatures | 62.6 | 68.5 | 121 | 197 | 192 | 5 | 67% | esper | Stormfront Pegasus, Serra Angel, Leonin Skyhunter |
| 7 | artifacts | artifacts | 59.9 | 66.2 | 95 | 165 | 164 | 1 | 70% | bant | Golem Foundry, Myr Sire, Mind Stone |
| 8 | card draw | interaction | 59.6 | 63.8 | 85 | 119 | 116 | 3 | 69% | sultai | Sign in Blood, Read the Bones, Divination |
| 9 | mana fixing | mana | 57.9 | 62.2 | 51 | 81 | 79 | 2 | 85% | temur | Evolving Wilds, Terramorphic Expanse, Shivan Reef |
| 10 | tokens | tokens | 57.5 | 63.4 | 77 | 110 | 107 | 3 | 67% | naya | Evangel of Heliod, Peregrin Took, Howl of the Night Pack |
| 11 | control | interaction | 56.0 | 60.7 | 97 | 140 | 133 | 7 | 76% | esper | Negate, Cancel, Mass Calcify |
| 12 | lifegain | lifegain | 54.9 | 61.5 | 88 | 165 | 162 | 3 | 63% | abzan | Soulmender, Child of Night, Nyx-Fleece Ram |
| 13 | tempo | interaction | 52.1 | 59.0 | 89 | 148 | 145 | 3 | 72% | jeskai | Act of Treason, Unsummon, Retraction Helix |
| 14 | tribal | tribal | 50.5 | 58.6 | 66 | 97 | 94 | 3 | 83% | mardu | Diffusion Sliver, Venom Sliver, Kragma Warcaller |
| 15 | ramp | mana | 50.2 | 52.6 | 54 | 77 | 63 | 14 | 84% | temur | Elvish Mystic, Mind Stone, Kiora's Follower |
| 16 | evasion | evasive creatures | 48.6 | 56.7 | 75 | 117 | 116 | 1 | 65% | grixis | Tormented Soul, River Boa, Goblin Tunneler |
| 17 | burn | interaction / direct damage | 46.3 | 54.9 | 55 | 86 | 86 | 0 | 75% | rakdos | Lightning Strike, Lava Axe, Fireball |
| 18 | equipment | artifacts | 44.0 | 53.7 | 23 | 41 | 41 | 0 | 94% | mono-white | Copper Carapace, Accorder's Shield, Bladed Pinions |
| 19 | go-wide | tokens | 43.5 | 51.4 | 59 | 83 | 82 | 1 | 52% | naya | Inspired Charge, Shamanic Revelation, War Flare |
| 20 | heroic | spells | 41.6 | 50.9 | 30 | 52 | 52 | 0 | 89% | naya | Lagonna-Band Trailblazer, Staunch-Hearted Warrior, Akroan Crusader |
| 21 | discard | interaction | 39.1 | 49.6 | 29 | 38 | 38 | 0 | 78% | grixis | Duress, Mind Rot, Whispering Madness |
| 22 | trample | evasive creatures | 39.1 | 48.8 | 39 | 51 | 50 | 1 | 59% | gruul | Oliphaunt, Temur Battle Rage, Terra Stomper |
| 23 | graveyard recursion | graveyard | 38.3 | 48.0 | 33 | 51 | 51 | 0 | 70% | abzan | Perennial Behemoth, March of the Returned, Alesha, Who Smiles at Death |
| 24 | sacrifice | sacrifice | 37.5 | 46.6 | 44 | 62 | 62 | 0 | 47% | jund | Nasty End, Fling, Act of Treason |
| 25 | enchantments matter | enchantments | 37.5 | 47.6 | 32 | 69 | 69 | 0 | 63% | abzan | Grim Guardian, Harvestguard Alseids, Dreadbringer Lampads |
| 26 | defensive creature | combat / defensive creatures | 37.1 | 46.9 | 40 | 68 | 68 | 0 | 82% | bant | Wall of Mulch, Wall of Fire, Stalwart Shield-Bearers |
| 27 | infect / proliferate | poison | 35.9 | 47.3 | 12 | 27 | 27 | 0 | 90% | orzhov | Phyrexian Juggernaut, Vector Asp, Phyrexian Digester |
| 28 | prowess / spell-matter | spells | 35.9 | 47.2 | 16 | 24 | 24 | 0 | 93% | jeskai | Mistfire Adept, Elusive Spellfist, Prescient Chimera |
| 29 | mill | graveyard | 35.6 | 46.9 | 16 | 25 | 25 | 0 | 92% | dimir | Shriekhorn, Mind Sculpt, Millstone |
| 30 | deathtouch | combat / keyword abilities | 35.4 | 46.7 | 14 | 24 | 24 | 0 | 80% | golgari | Typhoid Rats, Pharika's Chosen, Sedge Scorpion |
| 31 | voltron | combat / single-creature | 35.0 | 44.0 | 39 | 55 | 55 | 0 | 22% | mardu | Open the Armory, Aqueous Form, Gods Willing |
| 32 | lifegain-drain | lifegain | 34.8 | 45.0 | 25 | 35 | 35 | 0 | 50% | mardu | Gray Merchant of Asphodel, Grim Guardian, Havoc Festival |
| 33 | spellslinger | spells | 34.3 | 46.0 | 17 | 19 | 19 | 0 | 82% | jeskai | Gandalf, White Rider, Skywise Teachings, Mnemonic Wall |
| 34 | manifest | creature mechanics | 34.1 | 46.1 | 8 | 12 | 12 | 0 | 100% | bant | Cloudform, Formless Nurturing, Ethereal Ambush |
| 35 | devotion | color synergies | 34.0 | 44.8 | 11 | 17 | 17 | 0 | 90% | jund | Gray Merchant of Asphodel, Karametra's Acolyte, Fanatic of Mogis |
| 36 | self-mill | graveyard | 33.7 | 44.4 | 14 | 25 | 24 | 1 | 84% | sultai | Satyr Wayfinder, Nyx Weaver, Returned Reveler |
| 37 | aristocrats | sacrifice | 33.5 | 44.6 | 15 | 19 | 19 | 0 | 80% | mardu | Falkenrath Noble, Uglúk of the White Hand, Collateral Damage |
| 38 | morph / megamorph | creature mechanics | 33.4 | 45.6 | 10 | 10 | 10 | 0 | 100% | bant | Deathmist Raptor, Guardian Shield-Bearer, Sandstorm Charger |
| 39 | reanimator | graveyard | 33.1 | 45.8 | 3 | 3 | 3 | 0 | 100% | golgari | Jarad's Orders, Grave Betrayal, Dread Slaver |
| 40 | threaten / theft | interaction | 33.1 | 45.2 | 7 | 7 | 7 | 0 | 100% | grixis | Traitorous Blood, Sauron, the Lidless Eye, Soul Ransom |
| 41 | midrange threats | midrange | 33.1 | 43.2 | 36 | 63 | 60 | 3 | 60% | jund | Aegis Angel, Garruk's Packleader, Ancient Silverback |
| 42 | gates | lands / color synergies | 32.7 | 45.4 | 4 | 4 | 4 | 0 | 100% | grixis | Rakdos Guildgate, Way of the Thief, Ubul Sar Gatekeepers |
| 43 | madness | discard / graveyard synergies | 32.3 | 45.1 | 2 | 2 | 2 | 0 | 100% | rakdos | Vaultbreaker, Twins of Maurer Estate |
| 44 | delve | graveyard | 32.0 | 44.2 | 6 | 9 | 9 | 0 | 93% | golgari | Gurmag Angler, Hooting Mandrills, Soulflayer |
| 45 | blink | interaction | 31.9 | 42.6 | 19 | 27 | 26 | 1 | 72% | bant | Temur Sabertooth, Stonehorn Dignitary, Shrieking Drake |
| 46 | name matters | card advantage / deck construction | 31.8 | 44.4 | 5 | 5 | 5 | 0 | 100% | temur | Sphinx of the Chimes, Signal the Clans, Stomping Slabs |
| 47 | landfall | mana | 31.8 | 42.1 | 11 | 25 | 25 | 0 | 50% | gruul | Evolving Wilds, Embodiment of Insight, Retreat to Kazandu |
| 48 | multicolor matters | color synergies | 31.4 | 43.7 | 11 | 13 | 13 | 0 | 86% | sultai | Bring to Light, Neutralizing Blast, Maze Abomination |
| 49 | big mana | mana | 31.2 | 41.1 | 17 | 23 | 20 | 3 | 70% | jund | Mage-Ring Network, Dictate of Karametra, Colossus of Akros |
| 50 | artifact hate | artifacts / interaction | 31.1 | 41.3 | 16 | 24 | 24 | 0 | 89% | naya | Disenchant, Fade from History, Westfold Rider |
| 51 | -1/-1 counters | counters | 30.1 | 41.8 | 8 | 18 | 18 | 0 | 63% | sultai | Flourishing Defenses, Grafted Exoskeleton, Tower Above |
| 52 | delirium | graveyard | 30.1 | 42.6 | 4 | 4 | 4 | 0 | 90% | abzan | Tooth Collector, Hound of the Farbogs, Moorland Drifter |
| 53 | land destruction | lands / interaction | 29.1 | 40.3 | 13 | 16 | 16 | 0 | 79% | jund | Volcanic Upheaval, Frenzied Tilling, Spiteful Blow |
| 54 | manland | lands / utility lands | 28.9 | 41.0 | 3 | 7 | 7 | 0 | 73% | gruul | Dread Statuary, Skarrg Guildmage, Elemental Uprising |
| 55 | lifegain payoffs | lifegain | 28.4 | 39.6 | 5 | 11 | 11 | 0 | 99% | abzan | Ajani's Pridemate, Wall of Limbs, Sunbond |
| 56 | colorless matters | color synergies | 28.4 | 39.7 | 14 | 18 | 18 | 0 | 52% | grixis | Swarm Surge, Ruins of Oran-Rief, Sky Scourer |
| 57 | convoke | creature mechanics / cost reduction | 28.1 | 40.2 | 4 | 8 | 8 | 0 | 78% | mardu | Covenant of Blood, Warlord's Elite, Crowd's Favor |
| 58 | graveyard count matters | graveyard | 26.9 | 38.2 | 5 | 10 | 10 | 0 | 42% | temur | Undergrowth Scavenger, Satyr Wayfinder, Spellheart Chimera |
| 59 | flying hate | evasive creatures | 26.8 | 37.3 | 15 | 26 | 26 | 0 | 73% | jund | Plummet, Juvenile Gloomwidow, Windstorm |
| 60 | mana sink | mana / activated abilities | 26.6 | 37.4 | 10 | 15 | 14 | 1 | 43% | jund | Carnivorous Moss-Beast, Colossus of Akros, Zof Shade |
| 61 | enchantment hate | enchantments / interaction | 26.3 | 35.2 | 12 | 19 | 18 | 1 | 61% | naya | Revoke Existence, Reclamation Sage, Disenchant |
| 62 | legendary matters | legendary | 25.4 | 36.9 | 5 | 6 | 6 | 0 | 43% | abzan | Bag End Porter, You Cannot Pass!, Nasty End |
| 63 | lands matter | mana | 25.4 | 34.9 | 9 | 11 | 9 | 2 | 49% | naya | Rubblehulk, Woodborn Behemoth, Embodiment of Insight |
| 64 | land type matters | lands / color synergies | 25.4 | 36.7 | 7 | 9 | 9 | 0 | 33% | jeskai | Seismic Strike, Convincing Mirage, Spawn of Thraxes |
| 65 | suspend | spells / exile mechanics | 25.2 | 37.2 | 1 | 1 | 1 | 0 | 100% | mono-red | Shivan Sand-Mage |
| 66 | phasing | interaction / temporary board control | 25.2 | 37.1 | 1 | 1 | 1 | 0 | 100% | mono-blue | Time and Tide |
| 67 | phyrexian mana | spells / cost mechanics | 25.1 | 37.1 | 1 | 1 | 1 | 0 | 100% | mono-red | Rage Extractor |
| 68 | banding | combat / keyword abilities | 25.1 | 37.1 | 1 | 2 | 2 | 0 | 100% | mono-white | Teremko Griffin |
| 69 | graveyard hate | graveyard | 24.8 | 36.0 | 7 | 11 | 11 | 0 | 86% | abzan | Rotfeaster Maggot, Cremate, Beckon Apparition |
| 70 | swamps matter | mana | 24.2 | 35.7 | 3 | 4 | 4 | 0 | 83% | mono-black | Nightmare, Squelching Leeches, Staff of the Death Magus |
| 71 | tokens hate | tokens / interaction | 23.3 | 34.8 | 2 | 2 | 2 | 0 | 80% | rakdos | Illness in the Ranks, Rollick of Abandon |
| 72 | goblins | tribal | 19.7 | 30.1 | 9 | 9 | 9 | 0 | 0% | rakdos | Raging Goblin, Rummaging Goblin, Krenko's Enforcer |
| 73 | tribal hate | tribal | 19.6 | 30.6 | 2 | 2 | 2 | 0 | 47% | boros | Homing Lightning, East-Mark Cavalier |
| 74 | charge counters | counters / artifacts | 15.0 | 25.0 | 1 | 1 | 1 | 0 | 0% | mono-white | Surge Node |

## Strongest 2-Theme Shells

These shells are ranked from actual same-card theme overlap plus the size and cohesion of the combined card pool.

| Rank | Shell | Score | Best Colors | Overlap Cards | Union Cards | Overlap Share | Binder Availability | Representative Cards |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | mana fixing + ramp | 72.5 | temur | 15 | 90 | 7% | 89% | Shire Terrace, Market Festival, Darksteel Ingot, Opaline Unicorn |
| 2 | auras + voltron | 72.5 | mardu | 17 | 123 | 8% | 100% | Aqueous Form, Open the Armory, Shiv's Embrace, Sage's Reverie |
| 3 | auras + spot removal | 70.4 | mardu | 10 | 235 | 2% | 100% | Pacifism, Oppressive Rays, Brink of Disaster, Viper's Kiss |
| 4 | combat tricks + spot removal | 68.0 | naya | 13 | 246 | 1% | 100% | Valorous Stance, Spatial Contortion, Night // Day, Fury Charm |
| 5 | burn + spot removal | 65.4 | mardu | 12 | 187 | 3% | 100% | Lightning Strike, Searing Blood, Prodigal Pyromancer, Pinnacle of Rage |
| 6 | artifacts + ramp | 64.0 | temur | 15 | 134 | 6% | 87% | Mind Stone, Rust Goliath, Many Partings, Urza, Powerstone Prodigy |
| 7 | go-wide + tokens | 63.3 | naya | 14 | 122 | 9% | 96% | Howl of the Night Pack, Evangel of Heliod, Inspired Charge, Raise the Alarm |
| 8 | aggro + combat tricks | 63.2 | naya | 16 | 253 | 3% | 100% | Kinsbaile Skirmisher, Infantry Veteran, Hearth Charm, Zhur-Taa Swine |
| 9 | lifegain + mana fixing | 62.5 | abzan | 12 | 127 | 5% | 99% | Jungle Hollow, Thornwood Falls, Bloodfell Caves, Scoured Barrens |
| 10 | artifacts + tokens | 60.7 | naya | 11 | 161 | 6% | 98% | Golem Foundry, Myr Sire, Peregrin Took, Sensor Splicer |
| 11 | aggro + fliers | 60.5 | mardu | 16 | 259 | 4% | 99% | Vampire Interloper, Skyknight Legionnaire, Stormfront Pegasus, Reckless Imp |
| 12 | +1/+1 counters + spot removal | 59.8 | abzan | 7 | 250 | 1% | 96% | Foray of Orcs, Bloodcrazed Hoplite, Abzan Advantage, Hunt the Weak |
| 13 | +1/+1 counters + combat tricks | 58.9 | naya | 9 | 219 | 3% | 96% | Gaea's Gift, Rescue Retriever, Hindervines, Burst of Strength |
| 14 | control + tempo | 57.8 | jeskai | 19 | 167 | 5% | 91% | Blinding Drone, Involuntary Cooldown, Griptide, Ether Well |
| 15 | +1/+1 counters + heroic | 57.6 | bant | 10 | 133 | 7% | 93% | Lagonna-Band Trailblazer, Staunch-Hearted Warrior, Centaur Battlemaster, Bloodcrazed Hoplite |

## Strongest Color-Cohesive Shells

Focused on shells that show the clearest internal identity rather than broad, generic interaction spillover.

| Color Shell | Top Themes | Best 2-Theme Shell | Notes |
| --- | --- | --- | --- |
| mardu | spot removal (16.1), auras (11.8), aggro (9.4) | auras + spot removal (27.3) | 235 cards in the combined pool, 100% binder availability, 10 direct overlap cards. |
| naya | spot removal (13.8), combat tricks (11.2), +1/+1 counters (9.4) | combat tricks + spot removal (24.6) | 246 cards in the combined pool, 100% binder availability, 13 direct overlap cards. |
| abzan | spot removal (13.7), auras (10.7), combat tricks (10.1) | +1/+1 counters + spot removal (23.1) | 250 cards in the combined pool, 96% binder availability, 7 direct overlap cards. |
| temur | spot removal (10.2), ramp (8.7), mana fixing (8.5) | mana fixing + ramp (15.8) | 90 cards in the combined pool, 89% binder availability, 15 direct overlap cards. |
| jund | spot removal (15.4), combat tricks (7.9), mana fixing (7.7) | no standout pair | 144 cards contribute to the lead theme with 100% binder availability. |
| jeskai | spot removal (10.9), auras (9.5), aggro (8.2) | control + tempo (13.5) | 167 cards in the combined pool, 91% binder availability, 19 direct overlap cards. |
| bant | +1/+1 counters (9.8), combat tricks (9.8), auras (8.3) | +1/+1 counters + heroic (12.7) | 133 cards in the combined pool, 93% binder availability, 10 direct overlap cards. |
| rakdos | spot removal (12.4), aggro (6.9), auras (6.5) | no standout pair | 144 cards contribute to the lead theme with 100% binder availability. |
| grixis | spot removal (12.1), card draw (8.1), auras (7.5) | no standout pair | 144 cards contribute to the lead theme with 100% binder availability. |
| esper | auras (11.2), spot removal (10.5), card draw (7.8) | no standout pair | 101 cards contribute to the lead theme with 100% binder availability. |
| boros | spot removal (11.1), aggro (8.7), auras (8.5) | no standout pair | 144 cards contribute to the lead theme with 100% binder availability. |
| orzhov | spot removal (11.0), auras (10.4), lifegain (6.5) | no standout pair | 144 cards contribute to the lead theme with 100% binder availability. |

## Niche Themes

Low-breadth themes that still look like real archetype seeds instead of random one-offs.

| Theme | Score | Cards | Copies | Best Shell | Representative Cards |
| --- | ---: | ---: | ---: | --- | --- |
| manifest | 34.1 | 8 | 12 | bant | Cloudform, Formless Nurturing, Ethereal Ambush |
| reanimator | 33.1 | 3 | 3 | golgari | Jarad's Orders, Grave Betrayal, Dread Slaver |
| threaten / theft | 33.1 | 7 | 7 | grixis | Traitorous Blood, Sauron, the Lidless Eye, Soul Ransom |
| gates | 32.7 | 4 | 4 | grixis | Rakdos Guildgate, Way of the Thief, Ubul Sar Gatekeepers |
| delve | 32.0 | 6 | 9 | golgari | Gurmag Angler, Hooting Mandrills, Soulflayer |
| name matters | 31.8 | 5 | 5 | temur | Sphinx of the Chimes, Signal the Clans, Stomping Slabs |
| -1/-1 counters | 30.1 | 8 | 18 | sultai | Flourishing Defenses, Grafted Exoskeleton, Tower Above |
| delirium | 30.1 | 4 | 4 | abzan | Tooth Collector, Hound of the Farbogs, Moorland Drifter |
| manland | 28.9 | 3 | 7 | gruul | Dread Statuary, Skarrg Guildmage, Elemental Uprising |
| lifegain payoffs | 28.4 | 5 | 11 | abzan | Ajani's Pridemate, Wall of Limbs, Sunbond |
| convoke | 28.1 | 4 | 8 | mardu | Covenant of Blood, Warlord's Elite, Crowd's Favor |
| graveyard count matters | 26.9 | 5 | 10 | temur | Undergrowth Scavenger, Satyr Wayfinder, Spellheart Chimera |

## Inventory Pressure

These themes still score well overall, but a material share of their strength is currently tied up in decks instead of binders.

| Theme | Pressure | Overall Score | Binder Availability | Deck Copies | Representative Cards |
| --- | ---: | ---: | ---: | ---: | --- |
| ramp | 9.1 | 50.2 | 82% | 14 | Elvish Mystic, Mind Stone, Kiora's Follower |
| lands matter | 4.6 | 25.4 | 82% | 2 | Rubblehulk, Woodborn Behemoth, Embodiment of Insight |
| big mana | 4.1 | 31.2 | 87% | 3 | Mage-Ring Network, Dictate of Karametra, Colossus of Akros |
| control | 2.8 | 56.0 | 95% | 7 | Negate, Cancel, Mass Calcify |
| +1/+1 counters | 2.7 | 66.5 | 96% | 7 | Inspiring Call, Rosie Cotton of South Lane, Elite Scaleguard |
| mana sink | 1.8 | 26.6 | 93% | 1 | Carnivorous Moss-Beast, Colossus of Akros, Zof Shade |
| fliers | 1.6 | 62.6 | 97% | 5 | Stormfront Pegasus, Serra Angel, Leonin Skyhunter |
| midrange threats | 1.6 | 33.1 | 95% | 3 | Aegis Angel, Garruk's Packleader, Ancient Silverback |
| tokens | 1.6 | 57.5 | 97% | 3 | Evangel of Heliod, Peregrin Took, Howl of the Night Pack |
| tribal | 1.6 | 50.5 | 97% | 3 | Diffusion Sliver, Venom Sliver, Kragma Warcaller |
| card draw | 1.5 | 59.6 | 97% | 3 | Sign in Blood, Read the Bones, Divination |
| mana fixing | 1.4 | 57.9 | 98% | 2 | Evolving Wilds, Terramorphic Expanse, Shivan Reef |

