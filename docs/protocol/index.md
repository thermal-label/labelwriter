# Wire Protocols

This driver implements three distinct wire protocols across the
LabelWriter line. The device's `engine.protocol` field selects which
one applies.

## [`lw-450`](./lw-450) — LabelWriter 300 / 400 / 450 / 4XL

The classic LabelWriter chassis (300-series through 450-series, plus
SE450 / Wireless / Turbo / Twin Turbo / 4XL). 672-dot or 1248-dot
heads, 1-byte status reply, raster rows framed with `SYN` (`0x16`) or
RLE-compressed (`0x17`). See [LW 450 raster](./lw-450).

## [`lw-550`](./lw-550) — LabelWriter 550 / 550 Turbo / 5XL

The next-generation chassis. Different job structure entirely —
explicit job header (`ESC s`), per-label `ESC D` 12-byte preamble,
mandatory job trailer (`ESC Q`). 32-byte status reply with NFC-derived
media diagnostics (SKU number, label count remaining, counterfeit
detection). Genuine DYMO consumables are enforced in firmware. See
[LW 550 raster](./lw-550).

## [`d1-tape`](./duo-tape) — LabelWriter Duo tape engine

The LabelWriter Duo's tape-side engine (the chassis also has a 672-dot
label engine on a separate USB interface, which speaks `lw-450`).
Closely related to the [LabelManager D1
protocol](https://thermal-label.github.io/labelmanager/protocol) —
same `SYN`-row framing and `ESC C` / `ESC D` opcodes — but uses
`ESC E` for cutting and returns an 8-byte status reply. See
[Duo tape](./duo-tape) for the deltas.

## When to use which encoder

The driver dispatches automatically:

```ts
encodeLabel(device, bitmap, options);    // 450 + 550 (label engines)
encodeDuoTapeLabel(device, bitmap, opts); // d1-tape (Duo tape engine)
```

`encodeLabel` reads `engine.protocol` and forks between the 450 and
550 byte streams internally. The Duo tape side has its own entry
point because routing it through `encodeLabel` would obscure the
interface-number selection that callers need to be explicit about.

The encoder source lives in `packages/core/src/`:

| File              | Covers           |
| ----------------- | ---------------- |
| `protocol.ts`     | `lw-450` encoder + dispatch |
| `protocol-550.ts` | `lw-550` encoder, SKU / engine-version parsers |
| `duo-tape.ts`     | `d1-tape` Duo tape encoder |
| `duo-tape-status.ts` | `d1-tape` 8-byte status parser |
| `status.ts`       | 1-byte (450) / 32-byte (550) status parsers |
