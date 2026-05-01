# labelwriter — LabelWriter Twin Turbo runtime routing

> Wire engine routing into the encoder for the Twin Turbo and 450 Twin
> Turbo. The schema already declares two engines per chassis with
> `bind.address: 0` / `bind.address: 1` (landed in
> [migrate-to-contracts-shape.md](./migrate-to-contracts-shape.md)).
> What remains is the wire-bytes fix, the print-options shape, and the
> encoder logic that turns a caller-supplied engine choice into the
> right `ESC q` byte. This is the residual work after the schema
> migration.

---

## 1. What's already done

- `LW_TWIN_TURBO` and `LW_450_TWIN_TURBO` carry two engines each
  (`role: 'left'`, `bind.address: 0` / `role: 'right'`,
  `bind.address: 1`) — see `packages/core/data/devices/`.
- The contracts resolver returns both engines as drivable when the
  `lw-450` protocol module is registered.
- `protocol.test.ts:251` confirms the existing single-engine path with
  `{ roll: 1 }` still produces the same byte stream as before the
  migration — no regression for current callers.

The schema shape that earlier drafts of this plan proposed (a bespoke
`twinRoll: true` flag on the device entry) is superseded — the Twin
Turbo's twin-ness is now expressed by *having two engines*, which is
both more general and matches the Duo's two-engine shape.

---

## 2. Gap

### 2.1 Wrong wire bytes in `buildSelectRoll`

`packages/core/src/protocol.ts`:

```ts
export function buildSelectRoll(roll: 0 | 1): Uint8Array {
  return new Uint8Array([0x1b, 0x71, roll]);
}
```

This emits `1B 71 00` or `1B 71 01`. The `LW 450 Series Technical
Reference Manual` (page 16) specifies ASCII `'0'`/`'1'`/`'2'`
(`0x30`/`0x31`/`0x32`):

```
<esc> q n   Select Roll (Twin Turbo printer Only)
1B 71 ?     n specifies the roll to print on, where:
                30 (ASCII '0') = Automatic selection
                31 (ASCII '1') = Left roll
                32 (ASCII '2') = Right roll
```

The current byte values are **not valid** roll selectors — they happen
to silently no-op on the firmwares we've tested, which is why the bug
has gone unnoticed.

The unit tests in `packages/core/src/__tests__/protocol.test.ts` lock
in the wrong values, so the fix has to land alongside an updated test.

### 2.2 No "automatic" option, and the print-option name is stale

`LabelWriterPrintOptions.roll: 0 | 1` only expresses two of the three
firmware states. It is also named after rolls — but the migrate plan
landed engine routing as the cross-driver concept (`PrintEngine.role`
+ `bind.address`), so the option should be renamed `engine` to align
with the contracts shape and be reusable by any future address-routed
driver.

### 2.3 Encoder ignores `bind.address`

`encodeLabel` reads `engines[0]` for head geometry and protocol; it
never looks at `bind.address`. A Twin Turbo entry's two engines are
data-only until the encoder learns to emit `ESC q <bind.address>` for
the selected engine.

### 2.4 No engines API on the adapter

`LabelWriterPrinter.engines[role]` (per the migrate plan §6 test) does
not exist. Callers cannot ask "what engines does this device expose"
or route a print to a specific one without going through `encodeLabel`
directly.

### 2.5 Per-roll status detection

The 450 status byte (`packages/core/src/status.ts:18-35`) does not
carry per-roll information — `bit 0 paper out` reflects whichever roll
the firmware last selected. Twin Turbo behaviour here is
under-documented in the manual. Worth calling out in driver docs but
does **not** require a code change for this plan.

---

## 3. Proposed steps

### 3.1 Print-option shape

Replace `roll?: 0 | 1` in `LabelWriterPrintOptions` with:

```ts
engine?: 'auto' | string;
```

`'auto'` is the special routing mode (firmware-auto byte). Any other
string is matched against `engines[].role` on the active device. No
backwards-compat shim — the lib is pre-1.0 and `roll` has zero
documented external users.

### 3.2 Fix `buildSelectRoll`

`bind.address` carries the literal wire byte (`0x31` / `0x32`) on
each Twin Turbo engine entry, so the encoder doesn't need a lookup or
arithmetic. The function just prepends the byte the caller hands it:

```ts
/**
 * `ESC q <n>` — select roll on Twin Turbo.
 *
 * `n` is one of:
 *   0x30 ('0') — automatic selection (firmware picks an available roll)
 *   0x31 ('1') — first physical roll  (left)
 *   0x32 ('2') — second physical roll (right)
 *
 * Per LW 450 Series Tech Ref p.16. For explicit-engine routing the
 * protocol module reads the byte straight from `engine.bind.address`;
 * for auto mode it uses `ROLL_BYTE_AUTO`.
 */
export function buildSelectRoll(byte: number): Uint8Array {
  return new Uint8Array([0x1b, 0x71, byte]);
}

export const ROLL_BYTE_AUTO = 0x30;
```

Tests in `protocol.test.ts` update to assert the ASCII bytes.

### 3.3 Encoder behaviour

In `encodeLabel`, the engine resolution becomes:

- If the device has one engine with no `bind.address`: emit nothing
  extra (current behaviour, preserves byte-for-byte compatibility for
  every single-roll printer).
- If `options.engine === 'auto'` AND any engine on this device has a
  `bind.address`: prepend `ESC q ROLL_BYTE_AUTO` (`0x30`).
- If `options.engine` is a known role on this device AND that engine
  has a `bind.address`: prepend `ESC q engine.bind.address` (already
  the literal wire byte — no mapping needed).
- If `options.engine` is unset and the device has multiple engines
  with `bind.address`: prepend `ESC q ROLL_BYTE_AUTO` (default to
  auto).

The encoder then continues to read `engines[<resolved>].headDots` /
`.protocol` for the rest of the byte stream, instead of the current
`engines[0]` shortcut.

### 3.4 `LabelWriterPrinter.engines`

Expose a `Record<role, EngineHandle>` on the adapter so callers can
introspect what's drivable without parsing the device entry
themselves. Each handle carries the role, the underlying engine, and
a `print()` method that pre-binds `options.engine`. This is the
contract sketched in the migrate plan §6 test.

### 3.5 Documentation

- JSDoc on `LabelWriterPrintOptions.engine` explains the auto vs role
  distinction and the "left = first physical roll, right = second"
  convention as Dymo labels them on the device chassis.
- Driver docs flag that `PrinterStatus` reflects the active roll only
  — there is no way to read the inactive roll's media presence from
  the 450 status byte.

### 3.6 Tests

- `protocol.test.ts` — assert ASCII bytes (`0x30`/`0x31`/`0x32`); add
  `engine: 'auto'` case; add a "no `q` command on a single-engine
  device" case; add a "explicit `engine: 'right'` on Twin Turbo
  produces `0x32`" case.
- `devices.test.ts` — already covers the engines[] shape; nothing new.
- A `printer.engines.left.print(...)` integration test once the
  adapter API lands.

### 3.7 Out of scope

- Per-roll media detection — the 450 status byte cannot carry it and
  the Twin Turbo firmware does not extend the response.
- "Print N copies, alternating engines" — easy to layer on top later
  by varying `options.engine` per copy in the caller's loop. No
  in-encoder support needed.
- 4XL twin variants — none exist. The 4XL is single-roll wide-head.
