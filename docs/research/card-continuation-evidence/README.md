# Card Query pagination evidence

The adopted contract is [Specify recoverable Card Query continuation and adapter truncation — final resolution](https://github.com/OSmall/tomekin/issues/29#issuecomment-6230187644), confirmed at Q17 on 17 October 2026. This directory contains its supporting illustrations, not a second specification or implemented retrieval service.

- `2026-10-17-relay-selectors.schema.json`: closed typed selectors.
- `2026-10-17-relay-envelope-examples.json`: current request and success/error examples.
- `2026-10-17-relay-envelope-measurements.json`: full compact UTF-8 envelope sizes.
- `2026-10-17-relay-check.py`: reproducible fixture assertions. Run from the repository root with `python3 docs/research/card-continuation-evidence/2026-10-17-relay-check.py`.

The script consumes inherited public/synthetic record-content fixtures under `../card-projection-evidence/`; their former request selectors and outer envelopes are historical inputs, not current tool syntax. The generated Relay examples and selector schema above show the adopted transport shape.

Earlier continuation-envelope files were removed from this branch tip. Git history archives those superseded variants. These checks do not implement retrieval or measure live Scryfall throughput; the separate [pacing investigation](https://github.com/OSmall/tomekin/issues/82) remains open.
