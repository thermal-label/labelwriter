---
'@thermal-label/labelwriter-core': minor
---

Unify the media registry: paper rolls and D1 tape cassettes now live
side by side in a single `data/media.json5` source (47 entries) and a
single runtime `MEDIA` map keyed by `MediaKey`. The previous
`DUO_TAPE_MEDIA` named export is removed; tape entries are reachable
as `MEDIA.STANDARD_BLACK_ON_WHITE_12` etc. A new `allTapeMedia()`
helper returns the tape slice for callers that want it. Tape entries
in source declare `widthMm` / `material` / `background` / `text` /
`skus`; the compile script fills `category`, `tapeWidthMm`,
`tapeColour` (via the `tapeColourFor` mapping), and the default
`targetModels`.

Migration: replace `DUO_TAPE_MEDIA.X` with `MEDIA.X` (keys unchanged).
Replace `Object.values(DUO_TAPE_MEDIA)` with `allTapeMedia()`.
