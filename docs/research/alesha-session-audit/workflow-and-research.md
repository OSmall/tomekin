# Alesha session workflow and research audit

Evidence is the local `session_alesha.jsonl`, referenced by physical JSONL line and event ID. No live deck edits performed. Full, bounded excerpts of the useful research are in `session research at the cited transcript events` (L170, L188, L308, L337, L403). Logs are at `.data/tomekin.log`; friction/tool agents own broad correlation. The log contains extremely voluminous SQL debug output (the first candidate-ID hits are around physical line 97,398,342), so this report does not pretend to have independently inspected the whole log.

## Main conclusion

The session did eventually produce useful strategy and a legal, owned 100-card deck, but the human supplied the strategic control loop. The agent began with broad category searches and a premature sacrifice/Zombie direction; repeatedly needed explicit prompting to reason from commander actions, research search vocabulary before retrieval, restore ordinary support functions, use probability, and analyze colored mana. Existing skills contain many of these ingredients but distribute them across lifecycle, shared methodology, Commander architecture, and query mechanics. They present reference constraints and examples more strongly than an unmistakable ordered construction process with done conditions.

## Actual sequence, with autonomy versus steering

1. L4 requests powerful, synergistic, owned-only Alesha from any location. L7 lookup establishes Mardu. L10 asks agent to lead steps. Agent proposes preferences → explore → draft → checks (L14), then asks combo permission (L16–17). No action-based commander analysis precedes search.
2. Agent reads root, Commander architecture, shared methodology and query skills, drafts Brief (L22), and performs broad searches L26–40. L42 names a sacrifice/recursion/drain core. Partial pool saved. User asks about graph L49; L52 admits only two roles, seven assessed cards, no explicit win routes/relationships. User agrees and agent creates 11 roles, two win routes, 21 relationships L60.
3. New location Wretched Ranks is investigated L61–77: 67 mono-black Zombie cards. Agent incorrectly narrows whole build scope; user corrects via ask_user response and agent restores all-location policy L79–85. New-location scouting should inherit existing whole-build permission.
4. User asks template coverage L86 and progress L92. Agent admits 16 assessed options, zero selection (L91–93). User explicitly orders pool expansion L94. Broad support search grows pool, but tool acknowledgements lag progress claims (L113 says saving 81 to reach 97; L116 says first save reached only 62).
5. User explicitly orders tag snowball L115. Agent follows seed tags and finds martyr, leaves-body-behind, enters-in-company branches L126. User calls out failure to prioritize power <=2 L128. Agent demotes higher-power Zombies to independent support L129–133.
6. User teaches full Oracle decomposition L134: cheap commander, early ramp, attack access, haste, colored activation mana, useful low-power ETB/death/combat-damage bodies, entered-attacking distinction, support roles and finish. Agent searches accordingly L140–162; saves 17 better options L166, including Marauder/Boggart enabling evasion before blockers, H.E.R.B.I.E. repeated cards/development, setup and recovery.
7. User has to restore conventional rocks and Sol Ring priority L167; agent agrees L168. It had over-weighted inability to pay Alesha's W/B hybrid cost rather than considering how colorless acceleration frees colored sources.
8. User teaches prerequisite reasoning again L169: deliberate graveyard setup through discard/mill/surveil/sacrifice, then event rewards and enhancement. User requests analysis before any more card search. Excellent ten-part action analysis appears L170 (585e00b1); details below.
9. User asks for research-before-search L171: each action/need → exceptional exemplar (ownership irrelevant for taxonomy) → inspect tags → read definitions → numeric/Oracle criteria. Agent performs batched exemplar lookups L176–178, tag definitions L180–186, selective Oracle verification L184, then returns complete search map L188. User separately adds generic card advantage, ramp, targeted/mass disruption L189. Agent researches these L198–205, updates stale graph assessments. This sequence is precisely the strategic preparation the user wanted the skills to induce autonomously.
10. User orders researched wide search L210. Agent starts five branches L219–227, then user intervenes at context limit L230. Fifteen assessed additions saved, pool 136 L237. Research initially saved as condensed plan.description, not separate markdown; user requests full preservation L238–244, delays force direct update L250–253. Compaction L254.
11. Resume L255 cannot fetch full oversized plan; multiple candidate reads L258–268 fail to retrieve it. User pastes full research L273. Agent finishes low-power survey (364 eligible identities L292), checks broader support and adds 30 cards, pool 166 L302. Broad type/power fallback was useful for coverage but expensive relative to a stronger initial action map.
12. User asks strongest/weakest pool roles L303. Agent supplies honest support assessment L308: strong interaction, setup, recurring bodies; weaker mass disruption, sustained acceleration, winning throughput. User agrees departure below six sweepers, then explicitly orders turn-by-turn reasoning and hypergeometric count design L309. First calculator calls follow at L316 onward, after all pool research.
13. L337 derives turn-four productive attack, explicit draw assumptions, role counts/access probabilities, and slot tradeoffs. User approves and requests construction L338. Save L345; explicit legality/evaluation/joint Availability L347–357; pull list/role reads and assessment cleanup L362–377. L379 presents full 100-card deck.
14. User flags only two Mountains and asks whether curve/color math happened L380. Agent had inspected curve but admits no sufficient colored-source analysis L383/L403. Runs source benchmarks, proposes land correction. User requests wrap L404, save only land changes L406; mutation L409; user then requests checks L412; L415 checks yield final 100 cards, 38 lands, legality passed, 100 eligible copies, 49 borrowed (L419). Color math was a late repair rather than an input to selection.

## Research digest: governing action chain

L170's good framework, produced only after L169, is worth preserving as a compact example rather than a mandatory ten-role taxonomy:

Develop mana → deliberately stock graveyard → deploy Alesha → enable funded attack → return useful creature → exploit entry/combat/death events → reset or preserve → convert resource advantage into a finish.

Each candidate answers: which link or reward does it supply, its prerequisites, cost/timing, whether the deck can supply inputs, whether it does useful work when commander/graveyard is unavailable, and what it displaces.

Alesha analysis:

- Cast {2}{R}; three mana suggests normal early rock/land development, but early empty commander is not productive.
- Need worthwhile power <=2 creature card in graveyard before a productive attack. Combat death alone is unreliable. Chosen discard, self-mill, surveil, sacrifice and self-sacrifice are distinct setup routes. Scry is selection, not setup.
- Must declare Alesha attacking repeatedly; first strike helps selectively; haste, evasion, blocker management and protection differ. She need not connect for return.
- Pay two W/B hybrid mana per return, while leaving resources for protection/setup. Returned ETB mana cannot pay the already-completed return that generated it.
- Return useful ETB, static, death or combat-damage effects. Entering attacking does not create an ordinary own-attack trigger; tapped return delays tap abilities.
- Events to reward include creature/card leaving graveyard, creature entering, ETB triggering, added attacking body with exact timing restrictions, damage connecting, later sacrifice/death. Exact controller/token/type/color/once-per-turn wording matters.
- Repeated reset needs repeatable low-cost outlets and bodies; preserve blockers/devotion/engines instead of sacrificing everything indiscriminately.
- Extra triggers/combats, ETB doubling, blink/reanimation and mass return raise ceiling but consume resources and should follow a functioning base engine.
- Finish must have sufficient output and complete mechanism. Repeated Gray Merchant with devotion, entry/death drain, sacrifice damage, growing evasive combat, mass return were branches; no complete infinite combo established.
- Maintain independent draw, mana, interaction, protection and recovery.

The user's present tapping example extends this method one causal step further: attack declaration normally taps Alesha (vigilance changes this), so relevant becoming-tapped rewards are a research branch. The transcript's final research did not include this. It should prompt consideration of actual rules events and prerequisites, not require a comprehensive executable graph. Also distinguish entering tapped from an untapped-to-tapped event when examining returned creatures. Any niche interaction needs exact rules/card verification before inclusion.

## Research digest: exemplar → tags → definition → criteria

Observed source path is local imported Scryfall card/tag facts through lookup_cards and browse_tags, not a new web literature review. L188 discloses tags with null descriptions and uses inspected exemplar Oracle text instead of fabricating definitions. Tag family is a discovery hint; exact Oracle determines contribution. Example cards were explicitly allowed to be unowned and are not ownership claims.

| Branch | Exemplars / useful verified tags | Criteria / qualification |
| --- | --- | --- |
| Deploy/fund | Sol Ring, Arcane Signet, Command Tower; mana-rock, ramp, mana-producer, rainbow-land, utility-mana-rock | MV0–1 branch, <=2 conventional rocks, separate three-mana utility; total install cost, tapped entry, color, net mana, first profitable turn. |
| Graveyard setup | Supplier: mill-self, death-trigger-self; Looting: discard-outlet, loot; Rubble Rouser: rummage; Doom Whisperer: surveil/repeatable-surveil; Feeder: free-sacrifice-outlet/sacrifice-outlet-creature; Retainers: martyr/sacrifice-self | Start cheap setup <=2, compare repeated engines; intended Alesha targets t:creature pow<=2; independent Oracle mill/discard/surveil/sacrifice; before-first-attack readiness. |
| Attack access | Boots, Marauder, Passage, Reconnaissance; gives-haste, gives-evasion, gives-flying, gives-unblockable, protects-creature, remove-from-combat | Casting + equip/activation cost; exact recipients; proactive haste vs protection vs blocker access; ETB can help before blockers but cannot retroactively give pre-declaration haste. |
| Repeated mana | Altar, Plunderer, Priest of Gix, H.E.R.B.I.E.; mana-producer, sacrifice-outlet-creature, death-trigger, repeatable-treasures, refund/full-refund, land-ramp, sneak-land | Colors/net mana/cost/timing; tapped delayed resources differ from immediate refund; combat output funds later actions. |
| Useful targets | H.E.R.B.I.E., Chupacabra, Pilgrim, Siege-Gang, Supplier, Agents of HYDRA, Shimian Specter; cantrip, removal-creature, spot-removal, tutor, enters-in-company, death-trigger-self, leaves-body-behind, saboteur | pow<=2 without blanket MV ceiling; Oracle enters/dies/combat-damage alternatives; cast-dependent ETB, additional costs, damage type. |
| Reward events | Tormod, Soul Warden, Ayara, Haruspex; leaves-graveyard-trigger, leaving-graveyard-matters, reanimate-matters, creaturefall, soul-warden-ability, impact-effect, death-trigger, draw-engine, saboteur, attacking-matters | Search branches separately; event/controller/type/color/token restrictions; once-per-turn, one-or-more, payments, attacker-declaration timing. |
| Reset/reuse | Feeder, Bombardment, Ayara, Skeleton; free-/repeatable-sacrifice-outlet, plunder, bombard, martyr, sacrifice-self, reanimate-self, castable-from-graveyard | General outlet vs self-sacrifice vs type restricted; mana/tap/timing/fodder costs; reset throughput, not tag count. |
| Enhance | Panharmonicon, Resonator, Aurelia, Ephemerate, Living Death; trigger-doubler, copy-ability, extra-combat-phase, extra-untap, flicker-creature, reanimate-creature, mass-reanimation | Alesha vs ETB doubling, copied triggers need payment/targets, extra combats need untapping/mana, blink timing, symmetric return costs. Optional. |
| Close | Cutthroat, Merchant, Ayara, Bombardment, Mirror Entity, Living Death; blood-artist-ability, drain-life, group-slug, impact-effect, bombard, power-boost-to-all, mass-reanimation | Actual lethal/output, multiplayer reach, devotion, mana, type restrictions, delay; complete combo mechanism rather than hints. |
| Generic function | Arena, Swords, Act, Animate Dead; draw-engine, pure-draw, spot-removal, sweeper, protection, reanimate-creature, regrowth, recursion | Independent function and exact scopes; no blanket sweeper MV cap, alternate cost/asymmetry, destruction vs exile/sacrifice and own recovery. |

Generic support research L198–205 used Night's Whisper, Skullclamp, Esper Sentinel, Smothering Tithe, Light Up the Stage and related examples. Broad card-advantage taxonomy is not synonymous with net advantage: filtering, tutors, cantrips, hand-return and conditional draw need distinct qualifications. Mass disruption and ramp similarly need exact real-cost/effect checks.

## Quantitative design actually done

L337 works backward from T1 setup/engine, T2 rock/support, T3 Alesha, T4 first funded useful attack, T5–6 reset/value, T7+ convert. Library 99, seven opening + normal multiplayer draw; 10/11/12/14 cards seen at T3/4/5/7; no mulligans, extra draw, tutoring or milling. Marginal access does not prove joint execution, castability or even graveyard readiness.

- Seven early accelerators by T2: 49.8%; ordinary unaccelerated sequence must work.
- Ten direct setup by T3: 67.4%; eight cheap subset only 58.7%; counting slow effects does not fix early access.
- 22 useful targets, >=2 by T4: 75.6%; 24 would achieve 80%.
- Eight attack support, >=1 by T4: 62.5%; only five proactive options gives 45.2%; conditional need can justify compromise.
- Seven reset access by T5: 60.7%; eight would achieve 65%; exact free vs paid/tap/restricted counts still matter.
- Four independent recovery by T6: 43.6%.
- Six converters by T7: >=1 61%, >=2 20%; do not require two converters routinely; three actual big finishers only 37% access, four 46.2%.
- One pure multiplier by T5: 12.1%; deck must function without it.
- Higher access targets compete for finite slots: 75% setup by T3 needs 13, 70% attack-support by T4 needs ten. Choose supported function rather than pad with poor candidates.

Probability should support *each changed count, deadline, mana allocation and inclusion tradeoff through shared scenarios*. It need not mean one artificial independent calculation for every singleton. A card's input/output contribution and opportunity cost can be evaluated against existing measured bottlenecks; recalculate when it changes qualifying copies/deadlines, not to manufacture an inclusion score. No calculation here modeled the full multi-event engine.

L403 colored-source model: initial 27 B / 13 R / 16 W potential routes, conditional/overlapping. At 99 library/no extra access, one of 13 R by T3 is 77.3%, one of 20 is 90.8%. 22 B gives >=2 by T5 80.1%; 21 W gives >=2 by T6 81.7%. Proposed 22B/20R/19W compromises double-white; unconditional estimates 20B/19R/17W. Tapped lands/filter inputs/opponent dependence make source-seen optimistic. Ayara BBB on T3 not guaranteed. These calculations should have preceded list finalization.

## Result and unresolved risks

L379 initial final selected: 100 total (Alesha + 27 creatures + nine rocks +25 other spells +38 lands), 166 assessed pool. 26 of 27 creatures Alesha-returnable; Maw's independent combat-conversion job justifies its higher power. Counts overlap: 10 ramp, 10 setup, 26 targets, eight reset, eight attack/protection, 12 qualified access, 11 targeted disruption, four mass, four complementary recovery, six converters, one pure multiplier. Four mass vs baseline six accepted L309; eleven targeted vs twelve and conditional/late draw explicitly admitted L379. No infinite established, no cEDH claim. Graveyard hate/commander removal vulnerability remains.

Final land revision removes five Swamps, War Room, Rogue's Passage; adds four Mountains, Wind-Scarred Crag, Dedicated Commons, Iron Hills. Final L419 passes legality, 100 cards/38 lands, 100 eligible copies, 49 borrowed; no missing/policy shortfalls. Unlimited basics was newly clarified by user L380, but imported Availability still independently checked.

Potential stale-role defect after last land swap: War Room was credited as late card access and Passage as attack support in L379. L405 acknowledges losing both. L406 scope was persist mana only; L419 reports deterministic checks but no explicit role-assessment reconciliation, and no further candidate edit after L409. A count/summary such as 12 access/eight attack support must therefore not be reused without recounting. Current database inspection confirms both stale assessments (see the summary audit).

## Overhaul guidance tied to observed failures

- Put one ordered strategy in the root/shared entrypoint: confirm Brief → exact anchor Oracle/actions → research vocabulary for both synergy and essential support → bounded assessed pool → compare complementary supported packages → turn/deadline/probability targets → select and mana/curve solve together → validate/recount/persist/finish. Define a small done artifact for each stage.
- Make game actions prerequisites/costs/conditions/emitted events/limits the first analysis, before roles/graph. Then translate useful mechanisms to current role relationships; no need for an exhaustive rules simulator or a new rigid graph schema.
- First-class research map is action/need, exemplar, learned verified tag meaning, alternative Oracle/numeric criteria and timing caveat. Search branches are alternatives; finish chooses coherent packages rather than all branches.
- Cover generic support at vocabulary stage; synergy is a bonus after required functionality. Commander-provided recursion does not erase draw/setup/attack/mana requirements. Extra enhancers wait until inputs work.
- Make probability and colored sources operational stages rather than a distant optional calculator example. Separate cheap/late/conditional contributors and commander access; compare count tradeoffs and reuse calculations. Model actual costs/deadlines rather than draw a canonical histogram.
- Save research incrementally in retrievable bounded units. Existing plan.description storage accepted huge text the bounded read could not return; a skill-only instruction cannot fix this service mismatch. Until tooling is fixed, use focused owner fields and concise continuation plus a durable reference the supported read can retrieve. Do not claim a complete research archive from a condensed handoff.
- Continue authorized construction through stages without repeated 'pool only/no selection' stopping points unless the user limited scope (they did limit several passes here after progress stalled). Do not treat original full-build request as authorization for arbitrary unrelated swaps; do preserve its intent across stages.
- Re-read skills only when missing after compaction or changed; maintain loaded references/current stage in continuation. The transcript shows repeated root/schema reads even before compaction, but tool audit owns costs.
- After any membership change, reconcile lost/gained role contributions and numeric scenario before claiming current coverage. Deterministic legality is necessary but not strategic completion.
