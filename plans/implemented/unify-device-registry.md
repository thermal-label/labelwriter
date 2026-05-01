# labelwriter — Unify the device registry as a single source of truth

> Three in-flight backlog plans (`twin-turbo-support`, `duo-tape-support`,
> `amendment-support-300-series`) each add fields to `LabelWriterDevice`
> independently. None reconcile the additions. Meanwhile the hardware
> table is hand-maintained in three places (`HARDWARE.md`,
> `docs/hardware.md`, and the aggregated table on
> `thermal-label.github.io`). The aggregated site already pulls from
> `DEVICES` at build time; the in-repo docs do not. This plan
> consolidates the schema and removes the hand-maintained duplicates.

---

## 1. Where second-printhead specs already land

Quick assessment — the user's question is "do the existing plans cover a
second printhead, or do we need a new spec axis?"

- **Duo** (`LW_DUO_96`, `LW_DUO_128`, `LW_450_DUO`): the
  [`duo-tape-support.md`](./duo-tape-support.md) plan introduces a
  `duoTapeInterface?: { bInterfaceNumber, headDots }` field on
  `LabelWriterDevice`. That's the second-printhead model: the label side
  keeps the existing `headDots` / `bytesPerRow`; the tape side carries
  its own dot count (128 at 180 dpi). **Covered.**
- **Twin Turbo** (`LW_TWIN_TURBO`, `LW_450_TWIN_TURBO`): per the
  [`twin-turbo-support.md`](./twin-turbo-support.md) plan, both rolls
  share one print engine — the only thing the host can do is select
  which roll (`ESC q`). The plan adds a `twinRoll?: boolean` capability
  flag, no head-spec changes needed. **Covered.**
- **Pre-400 era + SE450** (LW 300/310/330/Turbo/EL40/EL60/SE450): the
  [`amendment-support-300-series.md`](./amendment-support-300-series.md)
  plan adds `dpi: 203 | 300` (required) and `serialBaud?` fields, and
  fixes the SE450's head metrics (`672/84` → `448/56` at 203 dpi).
  Different print resolutions per device, not second printheads, but
  same schema-expansion shape. **Covered.**

So the schema axes are correct. What's missing is consolidation — and
the docs duplication.

---

## 2. The two problems this plan solves

### 2.1 Schema additions across three plans collide

If we land all three plans verbatim, `LabelWriterDevice` ends up with
this shape, all bolted on independently:

```ts
interface LabelWriterDevice {
  // existing
  family: 'labelwriter';
  vid: number;
  pid: number;
  headDots: number;
  bytesPerRow: number;
  protocol: '450' | '550';
  network: NetworkSupport;
  nfcLock: boolean;
  // from amendment-support-300-series
  dpi: 203 | 300;
  serialBaud?: 9600 | 19200 | 115200;
  // from twin-turbo-support
  twinRoll?: boolean;
  // from duo-tape-support
  duoTapeInterface?: { bInterfaceNumber: number; headDots: number };
}
```

That works mechanically but reads as a junk drawer. Specifically:

- `headDots`, `bytesPerRow`, and `dpi` describe one print engine.
  `duoTapeInterface.headDots` describes a second one. The two are
  modelled with completely different shapes.
- `bytesPerRow` is **derivable** from `headDots / 8` — keeping both as
  required fields lets them drift. (Verified: every entry today
  satisfies `bytesPerRow === headDots / 8`.)
- `twinRoll`, `nfcLock`, and the future Wi-Fi/Bluetooth flags are all
  binary capability flags — no consistent grouping.
- No place to record device-level **quirks** in source. The docs
  aggregator carries `quirks` in the YAML overlay (e.g. the
  LabelManager PnP/PC PID collision), but those quirks belong to the
  device, not to a verification report. Hand-editing
  `docs/hardware-status.yaml` to record an immutable hardware fact
  is the wrong layer.
- `dpi` proposed as **required** (with backfill) is the right call; the
  rasterizer needs it unconditionally. Worth flagging because the
  amendment plan correctly insists on this.

### 2.2 Three hand-maintained device tables drift from `DEVICES`

Today:

| Table | Source | Drift status |
|---|---|---|
| `packages/core/src/devices.ts` `DEVICES` | canonical | source of truth |
| `HARDWARE.md` (repo root) | hand-typed table | drifted (lists "Twin Turbo" as `0x0018` and "Duo - 96/128", says SE450 is `0x0400` 672-dot — matches `devices.ts` but `devices.ts` is wrong on SE450 head metrics per the 300-series plan) |
| `docs/hardware.md` | hand-typed table | drifted (different model list — includes "LabelWriter SE450" but not "LabelWriter Duo - 96/128"; uses different status emoji set; PIDs match but other shapes diverge) |
| `thermal-label.github.io/docs/hardware/_data.json` | **auto-generated** by `scripts/build-hardware-page.mjs` from `@thermal-label/labelwriter-core`'s `DEVICES` + `docs/hardware-status.yaml` | in sync with `devices.ts` |

The aggregator already does the right thing: it imports `DEVICES`
directly, merges in the YAML overlay, and renders. The labelwriter
repo's own docs are the ones with the duplication problem. Two tables
to delete + one to generate.

There's also a small gap on the aggregator side: `pickCapabilities()` in
`build-hardware-page.mjs` is a hand-maintained allowlist of fields. New
fields (`dpi`, `twinRoll`, `duoTapeInterface`, `serialBaud`, `quirks`)
won't surface in the docs until that allowlist is updated.

---

## 3. Proposed schema — one consolidated edit

Land this **once**, before any of the three pending plans, so the
plans can refer to the agreed shape rather than each minting their own
field.

```ts
// packages/core/src/types.ts

export type LabelWriterProtocol = '450' | '550';
export type NetworkSupport = 'none' | 'wifi' | 'wired';

/** A print engine — physical printhead and its driving parameters. */
export interface PrintEngine {
  /** Native resolution in the head-perpendicular direction. */
  dpi: 203 | 300;
  /** Number of addressable dots across the head. */
  headDots: number;
  /**
   * The protocol generation this engine speaks. The 450 Duo's tape
   * engine speaks the D1 dialect, *not* '450' or '550'.
   */
  protocol: LabelWriterProtocol | 'd1-tape';
  /**
   * Optional: USB interface number on a composite device. Omitted for
   * the primary engine; required for secondary engines on the Duo.
   */
  bInterfaceNumber?: number;
}

export interface LabelWriterDevice extends DeviceDescriptor {
  family: 'labelwriter';
  vid: number;
  pid: number;

  /**
   * The primary print engine. For single-engine devices this is the
   * only engine. For the Duo this is the label-roll side.
   */
  engine: PrintEngine;

  /**
   * Secondary print engine, when present. The 450 Duo / Duo-96 /
   * Duo-128 use this for the D1 tape side. Future composite devices
   * that follow the same pattern slot here.
   */
  secondaryEngine?: PrintEngine;

  /** RS-232 default baud — only meaningful when 'serial' is in transports. */
  serialBaud?: 9600 | 19200 | 115200;

  /** Twin Turbo / 450 Twin Turbo accept the ESC q roll-select command. */
  twinRoll?: boolean;

  /** Network capability for transports beyond direct USB. */
  network: NetworkSupport;

  /**
   * 550-series NFC label authentication. When true, the printer
   * silently refuses non-genuine rolls regardless of host commands.
   */
  nfcLock: boolean;

  /**
   * In-source quirks worth showing in docs. Free-form markdown,
   * intended for immutable hardware facts (e.g. "PID collides with
   * the PC variant; needs usb_modeswitch on Linux"). Distinct from
   * verification-report notes in hardware-status.yaml — those are
   * tied to a specific issue and a specific reporter.
   */
  quirks?: string;
}
```

### 3.1 Why a `PrintEngine` sub-object instead of more flat fields

- Groups the four fields that travel together (`dpi`, `headDots`,
  `protocol`, optional interface number) so you can't have a device
  record a 203-dpi `headDots` against a 300-dpi rasterizer.
- Models the Duo as "two engines on one chassis" cleanly. The Duo
  plan's `duoTapeInterface: { bInterfaceNumber, headDots }` becomes
  `secondaryEngine: { dpi: 180, headDots: 128, protocol: 'd1-tape',
  bInterfaceNumber: ... }` — same content, consistent shape.
- Drops `bytesPerRow` from the top level entirely. Compute it from
  `engine.headDots / 8` at the one call site that needs it
  (`encodeLabel` in `protocol.ts`). Removes a derivable field that
  was only ever derivable.
- Leaves room for a third axis we don't have yet (e.g. a future
  print engine variant with `bytesPerLineMax` ≠ `headDots / 8`)
  without breaking the top-level shape.

### 3.2 Migration plan

Single PR, fan out the existing 14 entries:

```ts
// before
LW_450: {
  name: 'LabelWriter 450',
  family: 'labelwriter',
  vid: 0x0922, pid: 0x0020,
  headDots: 672, bytesPerRow: 84,
  protocol: '450',
  network: 'none', nfcLock: false,
  transports: ['usb', 'webusb'],
}

// after
LW_450: {
  name: 'LabelWriter 450',
  family: 'labelwriter',
  vid: 0x0922, pid: 0x0020,
  engine: { dpi: 300, headDots: 672, protocol: '450' },
  network: 'none', nfcLock: false,
  transports: ['usb', 'webusb'],
}
```

Touchpoints:

- `packages/core/src/protocol.ts:127` (`buildSetBytesPerLine(device.bytesPerRow)`)
  → `buildSetBytesPerLine(device.engine.headDots / 8)`.
- `packages/core/src/preview.ts` — anywhere it reads `headDots` or
  `bytesPerRow` directly.
- `packages/core/src/__tests__/devices.test.ts` — assertions that read
  the shape.
- `packages/core/src/__tests__/protocol.test.ts` — golden-byte tests
  that depend on fixture devices.
- The three pending plans — each updates its "schema additions" section
  to refer to the consolidated shape.

No public API change to the adapter classes (`LabelWriterPrinter`,
`WebLabelWriterPrinter`) — they use the encoder, which uses the
descriptor, all internal.

This refactor is mechanically a rename + re-shape; the diff is large
but uninteresting. Land it before any of the three pending feature
plans so they don't have to take care of two shapes during their work.

### 3.3 The `quirks` field is for in-source facts only

Two places to record device-related caveats today, used for different
things:

| Field | Lives in | Use |
|---|---|---|
| `LabelWriterDevice.quirks` (new) | source code (`devices.ts`) | Immutable hardware facts that ship with the descriptor. PID collisions, mass-storage modes, "this device shares a PID with X". Visible to `findDevice` callers. |
| `hardware-status.yaml#devices[].quirks` | docs overlay | Verification-time observations. "Tested on Linux only." "Status byte parser hits the spec but firmware 2.4 returns one fewer byte." Tied to a specific report. |

The aggregator's docs page can render both — surface the in-source
quirks in the table tooltip; surface the YAML quirks in the per-report
section. Keep them separate so an in-source quirk doesn't get blown
away when a YAML report is updated.

---

## 4. Single source of truth — generate the in-repo tables

### 4.1 What changes

- Replace the hand-typed table in `docs/hardware.md` with a
  generated fragment, the same way `_status-fragment.md` works in
  the github.io repo.
- Replace the hand-typed table in `HARDWARE.md` (repo root) the same
  way, OR delete it entirely and link `docs/hardware.md` from the
  README. (Recommended: delete `HARDWARE.md`. Two top-level docs
  files for the same content is the original sin we're fixing here.)
- Keep `docs/hardware-status.yaml` as-is — it's the verification
  overlay, not the device list, and the aggregator already pulls it.

### 4.2 New script: `scripts/build-hardware-fragment.mjs`

Mirrors the github.io aggregator's `buildPerDriverFragment()` but runs
inside the labelwriter repo against its own `DEVICES`:

```js
#!/usr/bin/env node
// Reads packages/core/dist/index.js DEVICES + docs/hardware-status.yaml
// Writes docs/hardware-table.md (or injects a marker block in
// docs/hardware.md)
```

Either approach works; preference is **inject into a marker block**
inside `docs/hardware.md` so the prose around the table stays
hand-edited:

```md
<!-- DEVICES:BEGIN -->
| Model | PID | Engine | Network | NFC lock | Status |
| ... auto-generated ... |
<!-- DEVICES:END -->
```

The script regenerates only between markers. Pre-push hook (or CI step)
runs it; CI fails if the file is dirty after running.

### 4.3 Integration with the github.io aggregator

`thermal-label.github.io/scripts/build-hardware-page.mjs:107-113`
hand-rolls a `pickCapabilities()` allowlist:

```js
for (const k of ['twoColor', 'autocut', 'compression', 'editorLite',
                 'network', 'nfcLock', 'protocol', 'headPins',
                 'headDots', 'supportedTapes', 'experimental',
                 'massStoragePid']) { ... }
```

This needs to be extended to pick up the new fields:

- `engine` (whole sub-object — let the table renderer pluck `dpi` /
  `headDots` from it).
- `secondaryEngine` (when present, render as a second row hint or a
  badge — design choice for the table renderer; the data side just
  needs to expose it).
- `twinRoll`, `serialBaud`, `quirks`.

Cleaner option: replace the allowlist with a denylist (`vid`, `pid`,
`name`, `family`, `transports` are already top-level columns; pick
**everything else**) so future schema additions don't require a
github.io PR. Tracked here because the user's "single source of truth"
goal is fully realised only when adding a field on this side
auto-propagates downstream.

### 4.4 Sequencing with the github.io repo

The aggregator imports `@thermal-label/labelwriter-core` from npm, not
from a sibling checkout. So any schema change in this repo only
affects the docs site **after** a release. The in-repo
`docs/hardware.md` updates immediately on the next `pnpm docs:build`.

That's fine, but it means a brief window where the repo's own docs
show the new shape and the aggregator still shows the old shape.
Mitigation:

1. Land the schema PR in this repo, publish a new
   `@thermal-label/labelwriter-core` version.
2. Bump the dependency in `thermal-label.github.io`, update
   `pickCapabilities` in the same PR.
3. Both sides aligned.

If someone adds a field that's used only in the local table (e.g. a
debug-only flag), they'd publish, bump, and update the aggregator —
or use the denylist approach in §4.3 to skip step 3.

---

## 5. Sequencing

1. **Schema consolidation** (§3) — one PR. Land first; blocks
   nothing currently in the registry but unblocks the three pending
   plans cleanly.
2. **Docs generation script** (§4.2) — second PR. Adds the script,
   converts `docs/hardware.md`, deletes `HARDWARE.md`, wires into
   `pnpm docs:build` and the pre-push hook.
3. **Update the three pending plans** to reference the consolidated
   schema. Each plan's "schema additions" section becomes one or two
   lines instead of a re-design. Mechanical edit.
4. **Update the github.io aggregator** (§4.3) — separate PR in
   that repo, after this repo publishes a release with the new
   schema.

Steps 1–3 are independent of step 4. The aggregator continues to work
during the gap because the old fields (`headDots`, `protocol`) can
remain as top-level computed accessors during a deprecation window
if we want to be polite to the npm consumers — but pre-1.0, the
cleaner move is "rename, publish, bump downstream".

---

## 6. Out of scope

- Changing the verification-report YAML schema (`hardware-status.yaml`).
  That schema is documented at
  `https://github.com/thermal-label/.github/blob/main/CONTRIBUTING/hardware-status-schema.md`
  and shared across all `@thermal-label/*` drivers. Touching it here
  would force coordinated edits in `brother-ql`, `labelmanager`, and
  the org-level `.github` repo.
- Per-roll status on Twin Turbo (already out of scope in the
  Twin Turbo plan; not a registry question).
- Migrating the LabelManager driver onto the same `PrintEngine` shape.
  The LabelManager descriptors currently carry `supportedTapes` and
  no head dot count; the abstractions diverge enough that a
  cross-driver `PrintEngine` would be a bigger discussion. Note for
  later, defer.
- A schema validator. The TypeScript type system catches shape
  mismatches at compile; a runtime validator (zod / valibot) is
  unnecessary overhead for an in-repo registry.

---

## 7. Open questions

1. **Drop `bytesPerRow` entirely or keep it as a non-required
   convenience accessor?** Leaning drop — it's pure derivation and
   keeping it invites drift. The encoder's one call site is trivial
   to update.
2. **`secondaryEngine` cardinality — array or singleton?** The Duo
   has exactly two engines. No DYMO product has three. Singleton
   reads cleaner; array generalises better. Vote: singleton, on
   YAGNI grounds.
3. **Does `protocol: 'd1-tape'` belong on the engine, or should the
   tape side carry its own family altogether?** The Duo plan has a
   long discussion on this (Options A–D). Whichever option that plan
   lands on, the schema here can accommodate — `'d1-tape'` as an
   engine-level protocol tag is the lightest weight.
4. **Aggregator: allowlist or denylist?** §4.3 leans denylist for the
   "single source of truth" goal but it's a github.io-side decision.
   Worth raising on that repo's issue tracker once this lands.
