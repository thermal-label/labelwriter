---
'@thermal-label/labelwriter-core': minor
'@thermal-label/labelwriter-node': minor
---

Consume `@thermal-label/d1-core` for the Duo's tape engine.

The `encodeLabel` dispatcher now recognises `engine.protocol === 'd1-tape'`
and routes to `@thermal-label/d1-core`'s `buildPrinterStream` — the same
encoder the LabelManager driver uses, since the Duo's tape engine is
electrically a LabelManager sharing the cable. Tape media's pre-computed
`tapeColour` (ESC C selector) maps to d1-core's `options.tapeType`;
without it, d1-core derives from the media's `text` / `background`.

`isEngineDrivable` now returns `true` for `d1-tape` (it's drivable
through this driver alone — no need to install labelmanager-core
alongside). `isDuoTapeEngine` is preserved as a thin
`engine.protocol === 'd1-tape'` predicate, used by the node adapter to
gate auto-mapping of the primary transport (the tape engine sits on a
separate USB interface — explicit `engineTransports.tape` is still
required).

Removed (replaced by d1-core): `buildDuoReset`, `buildDuoSetTapeType`,
`buildDuoBytesPerLine`, `buildDuoCutTape`, `buildDuoStatusRequest`,
`buildDuoRasterRow`, `encodeDuoTapeLabel`, `parseDuoTapeStatus`,
`DUO_TAPE_STATUS_BYTE_COUNT`, `DuoTapePrintOptions`, `tapeColourFor`.
The `buildDuoReset` (`ESC @`) opcode never existed in D1 firmware and
the 8-byte status reply was a misattribution from the lw-raster label
engine — both fall away with d1-core. UI helpers
(`D1_TAPE_COLOR_HEX`, `allTapeMedia`, width-keyed lookups) are
preserved.

`LabelWriterTapeMedia` now extends `D1Media` from d1-core. Same fields,
no runtime behaviour change. The Duo tape engine's status query reads
1 byte (was wrongly 8); ESC C selector lands at byte 0..2 of the wire
stream (was byte 3..5 after a leading ESC @).

Pre-publish: `@thermal-label/d1-core` consumed via `link:../d1-core`
override alongside the existing contracts override.
