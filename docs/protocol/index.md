# Wire Protocols

This driver implements three distinct wire protocols across the
LabelWriter line. The device's `engine.protocol` field selects which
one applies.

## [`lw-raster`](./lw-raster) — LabelWriter 300 / 400 / 450 / 4XL

The classic LabelWriter chassis (300-series through 450-series, plus
SE450 / Wireless / Turbo / Twin Turbo / 4XL). 672-dot or 1248-dot
heads, 1-byte status reply, raster rows framed with `SYN` (`0x16`) or
RLE-compressed (`0x17`). See [LW raster](./lw-raster).

## [`lw5-raster`](./lw5-raster) — LabelWriter 550 / 550 Turbo / 5XL

The next-generation chassis. Different job structure entirely —
explicit job header (`ESC s`), per-label `ESC D` 12-byte preamble,
mandatory job trailer (`ESC Q`). 32-byte status reply with NFC-derived
media diagnostics (SKU number, label count remaining, counterfeit
detection). Genuine DYMO consumables are enforced in firmware. See
[LW5 raster](./lw5-raster).

## `d1-tape` — LabelWriter Duo tape engine

The Duo's tape-side engine speaks the standard D1 protocol — same
encoder, same 1-byte status, same opcode vocabulary as a standalone
LabelManager (the Duo is electrically a LabelManager + LabelWriter
sharing one cable). Documented separately in
[`@thermal-label/d1-core`](https://thermal-label.github.io/d1-core/protocol).

The label side of the same chassis lives on a different USB interface
and speaks `lw-raster`.

## When to use which encoder

The driver dispatches automatically:

```ts
encodeLabel(device, bitmap, options, media);
// engine.protocol === 'lw-raster'  → 450 byte stream
// engine.protocol === 'lw5-raster' → 550 byte stream
// engine.protocol === 'd1-tape' → d1-core's buildPrinterStream
```

The encoder source:

| File                     | Covers                                             |
| ------------------------ | -------------------------------------------------- |
| `protocol.ts`            | `lw-raster` encoder + the unified dispatcher       |
| `protocol-550.ts`        | `lw5-raster` encoder, SKU / engine-version parsers |
| `status.ts`              | 1-byte (450) / 32-byte (550) status parsers        |
| `@thermal-label/d1-core` | `d1-tape` encoder + 1-byte status parser           |
