---
'@thermal-label/labelwriter-core': minor
---

Consume the D1 cassette catalogue + protocol docs from
`@thermal-label/d1-core`.

The 23 D1 tape entries that previously lived in this package's
`data/media.json5` now come from d1-core's shared catalogue (71
entries — adds 48 Rhino industrial cassettes and the 24 mm Standard
tier the Duo 128 / LW_450_DUO can drive). `compile-data.mjs` reads
d1-core's compiled `media.json` at build time and merges those
entries into the LabelWriter `MEDIA` registry alongside the paper
rolls.

`MEDIA` keeps its `MEDIA.STANDARD_BLACK_ON_WHITE_12` /
`MEDIA.ADDRESS_STANDARD` style access — the merged registry just has
more keys. Total: 95 entries (24 LW paper + 71 D1 tape).

Vocabulary alignment: `LW_DUO_128` and `LW_450_DUO` now declare
`['d1', 'd1-wide', 'd1-24']` so the 24 mm Standard tape entries
(`targetModels: ['d1-24']`) resolve only on chassis with the 128-dot
tape head.

Type extensions: `D1Material` gains the `rhino-*` variants;
`D1TapeColor` gains `brown` / `grey` / `metallic` / `purple` to
cover the Rhino catalogue's substrate range. `D1_TAPE_COLOR_HEX`
gets matching swatch entries.

Protocol docs: `docs/protocol/duo-tape.md` is gone — d1-core hosts
the canonical D1 reference shared with the LabelManager driver. The
LW protocol index and `docs/core.md` link out to
`https://thermal-label.github.io/d1-core/protocol`.
