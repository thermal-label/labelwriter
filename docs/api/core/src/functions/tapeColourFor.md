[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / tapeColourFor

# Function: tapeColourFor()

> **tapeColourFor**(`background`, `text`): `number`

Symbolic-colour → wire-format ESC C selector.

Per `LabelWriter 400 Series Technical Reference Manual` p.24 the
byte sets the heat sensitivity / strobe profile for the loaded
tape — it identifies what cassette is loaded so the firmware can
pick the right thermal-energy curve; it does not change the
printed ink. Sending `0` for an unenumerated combination is safe
(the cassette's actual ink prints either way), but the matching
spec value gives correct calibration and noticeably better print
quality on coloured / reverse-print substrates.

Spec table (LW 400 Series Tech Ref p.24):

  0  Black on white or clear        7  Black on fluorescent green*
  1  Black on blue                  8  Black on fluorescent red*
  2  Black on red                   9  White on clear
  3  Black on silver*              10  White on black
  4  Black on yellow               11  Blue on white or clear
  5  Black on gold*                12  Red on white or clear
  6  Black on green

  * — substrate variants not represented in `D1TapeColor` (no
      catalogued cassettes use silver, gold, fluorescent-green,
      or fluorescent-red today). Add the symbol to `D1TapeColor`
      and a branch here in the same change if a cassette ever
      declares one.

Verified against real hardware (per existing `duo-tape.ts` JSDoc
+ integration tests): selectors 0, 1, 7, 12. The remaining
selectors are spec-derived from the table above; safe to send and
expected to give correct heat calibration.

Source-of-truth for this mapping. `scripts/compile-data.mjs`
mirrors the table to bake `tapeColour` into D1 entries at
compile time; keep them in sync.

## Parameters

### background

[`D1TapeColor`](../type-aliases/D1TapeColor.md)

### text

[`D1TapeColor`](../type-aliases/D1TapeColor.md)

## Returns

`number`
