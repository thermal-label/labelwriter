# labelwriter — Migrate to the contracts device & media shape

> Port `LabelWriterDevice` and `LabelWriterMedia` (plus
> `D1Cartridge`) onto the shared shape defined in
> `../../../contracts/plans/backlog/generic-device-media-library.md`.
> Folds in the verification overlay (`docs/hardware-status.yaml` →
> inline `support` block in `data/devices/<KEY>.json5`) and subsumes five
> existing backlog plans.
>
> The shape itself is not litigated here — the contracts plan owns
> that. This plan covers what changes in the labelwriter package
> and how the migration lands.

---

## 1. Subsumed backlog plans

This plan replaces the schema portions of:

- `unify-device-registry.md` — `PrintEngine` sub-object,
  in-source quirks field, JSON registry.
- `expand-media-registry.md` — `skus`, `targetModels`, `category`
  on media entries; `D1Cartridge` reusing the contracts shape.
- `duo-tape-support.md` — bespoke `duoTapeInterface` field
  collapses into `engines[]` with `bind.usb.bInterfaceNumber`.
- `twin-turbo-support.md` — bespoke `twinRoll` flag collapses
  into two `engines[]` entries with `bind.address: 0` /
  `bind.address: 1`.
- `amendment-support-300-series.md` — `dpi` moves into
  `engines[].dpi`; `serialBaud` becomes
  `transports.serial.defaultBaud`.

Each subsumed plan should be moved to `plans/implemented/` (or
deleted if its non-schema content is fully captured here) when
this plan lands. Non-schema bits to preserve:

- `unify-device-registry.md` §4 in-repo `docs/hardware.md` cleanup
  — no-op once the docs site owns per-device pages (see the docs
  build plan); reduce to a one-line pointer.
- `expand-media-registry.md` §11 PDF-as-canonical decision — keep
  as a note in this driver's media registry README.
- `duo-tape-support.md` D1-tape protocol implementation — separate
  code-organisation question, not a schema question. Carry that
  forward as a follow-up plan if not done by the time this lands.
- `amendment-support-300-series.md` per-device 300-series details
  (specific PIDs, baud rates) — fold into `data/devices/<KEY>.json5`
  entries.

---

## 2. What changes in the package

### 2.1 New files

- `packages/core/data/devices/<KEY>.json5` — one file per device,
  source of truth. JSON5 with comments. Replaces the in-source
  `DEVICES` constant. PR blast radius scales with the change: a new
  device is one new file, a verification report is a one-line edit
  to one file.
- `packages/core/data/devices.json` — build artifact, aggregated
  `DeviceRegistry`. Imported by runtime code.
- `packages/core/data/media.json5` (optional, if we want to move
  media off in-source TS too — recommend yes for parity with
  devices). Includes `LabelWriterMedia` rows + `D1Cartridge` rows.
  Single file for media is fine — entries are smaller and less
  churn-prone than device entries.
- A small build script (`scripts/compile-data.mjs`) that globs
  `data/devices/*.json5`, validates and aggregates them, and writes
  `data/devices.json`. Runs as part of the existing build.

### 2.2 Modified files

- `packages/core/src/devices.ts` — was the registry; becomes a
  thin module that imports `data/devices.json` and re-exports as
  `DEVICES`, typed as `DeviceRegistry` (from contracts) with the
  `family: 'labelwriter'` driver tag.
- `packages/core/src/media.ts` — same shape; thin re-export of
  `data/media.json`.
- `packages/core/src/protocols.ts` (new or existing) — the
  `PROTOCOLS` registry from the contracts plan §3.5. `lw-450`,
  `lw-550`, optionally `d1-tape` if the protocol impl is in scope.
- The rasterizer — instead of reading `device.headDots` /
  `device.bytesPerRow`, reads `engine.headDots` for the engine
  being printed to. `bytesPerRow` is computed (`headDots / 8`),
  not stored.
- The transport-resolution logic (whatever picks WebUSB filters,
  USB device opens, serial port opens) — reads
  `device.transports.usb.{vid,pid}` etc. instead of top-level
  fields.
- `validate-hardware-status.mjs` — extended to validate the whole
  entry shape, not just the support block.

### 2.3 Removed files

- `docs/hardware-status.yaml` — content folds into per-device
  `support` blocks in `data/devices/<KEY>.json5`. The validator updates
  to read JSON; the YAML parser dependency goes.
- `docs/hardware.md` — reduced to a one-line pointer to the docs
  site's per-device pages (see the docs build plan).

---

## 3. Worked entries

The full set lands under `data/devices/` — examples here cover
the interesting cases. The plain `LW 450`, `450 Turbo`, `5xx`
single-engine entries follow the same shape as the §3.4 LW 450
example in the contracts plan.

**LW 450 Twin Turbo** — see contracts plan §3.4. Two engines,
shared USB transport, `bind.address: 0` / `bind.address: 1`. The
`lw-450` protocol module learns one rule: "if the engine has a
`bind.address`, prepend `ESC q <address>` to the job; if
`options.engine === 'auto'`, emit the firmware-auto byte."
Single-engine devices have no `bind.address`; nothing is prepended.

**LW 450 Duo** — see contracts plan §3.4. Two heterogeneous engines
(label + tape), two protocols (`lw-450` + `d1-tape`), two USB
interfaces. Until the `d1-tape` protocol implementation ships, the
runtime resolver returns the Duo with `engines.tape.drivable: false`
and `printer.engines.tape` is `undefined` — the Duo is honestly
"partially supported" without faking the tape side.

**LW 300-series serial devices** — declare a `serial` transport
block:

```json5
{
  key: "LW_330",
  name: "LabelWriter 330",
  family: "labelwriter",
  transports: {
    serial: { defaultBaud: 19200, supportedBauds: [9600, 19200] }
  },
  engines: [
    { role: "primary", protocol: "lw-330", dpi: 203, headDots: 384 }
  ],
  support: { status: "untested" }
}
```

`dpi` loosens to `number` at the contracts level (300-series carry
203; 4xx/5xx carry 300). The driver-internal type can re-narrow
with a union if useful for type-level branching.

**LW 5xx with NFC** — `mediaDetection` is a named contracts key;
`genuineMediaRequired` is a labelwriter-side key on
`engine.capabilities` via the open index signature (Dymo-only
today, so by the contracts plan's promotion rule it stays
driver-side until a second vendor lands a comparable mechanism).
The name is concept-shaped (`genuineMediaRequired`, not
`nfcLock`) so a future vendor with cassette-ID or RFID auth could
adopt the same key when promoted. Implementation detail and
mismatch behavior live in `hardwareQuirks` prose:

```json5
{
  key: "LW_550",
  // ...
  engines: [
    {
      role: "primary",
      protocol: "lw-550",
      dpi: 300,
      headDots: 672,
      mediaCompatibility: ["standard"],
      capabilities: { mediaDetection: true, genuineMediaRequired: true }
    }
  ],
  hardwareQuirks: "NFC-based roll authentication: refuses non-genuine rolls outright. On genuine rolls, the NFC-defined length is authoritative — host claims to print at a different length are silently overridden, manifesting as a misprint at NFC dimensions. Apps that compare detected vs selected media should warn the user before sending.",
  support: { status: "untested" }
}
```

Note the prose-level honesty about silent-misprint behavior. No
contracts-level enforcement tier; rails not walls.

The labelwriter package ships a typed extension for its driver-side
keys, so `genuineMediaRequired` is type-checked Dymo-side even
though it's an `unknown` to contracts:

```ts
// packages/core/src/types.ts
export interface LabelWriterEngineCapabilities {
  genuineMediaRequired?: boolean;
}
```

Apply via a `satisfies` check on the imported JSON if useful for
type-narrowing in driver code; cross-driver consumers (docs
aggregator) read the value via the index signature with a label
map.

---

## 4. Media registry

`LabelWriterMedia` extends `MediaDescriptor` (from contracts) with
no driver-specific additions beyond what the contracts plan
already promotes (`skus`, `category`, `targetModels`).

`D1Cartridge` is more ambitious — its colour-on-colour metadata is
D1-particular and stays driver-specific. But its `skus` field comes
from the contracts shape now, not a private one. `targetModels`
also comes from contracts and filters to `['duo']` (and any future
D1-bearing device).

The `D1_TAPE_COLOR_HEX` table from `expand-media-registry.md` lands
as a small in-source helper, not registry data — it's a colour
LUT, not catalogue metadata. Stays in `src/`.

---

## 5. YAML → JSON5 migration

For each existing `docs/hardware-status.yaml` entry, the migration
is mechanical: every field maps 1:1 into a `support` block on the
matching `data/devices/<KEY>.json5` entry. The verification ledger
(reports, dates, issue numbers) preserves intact; only the file
changes.

The migration script lands once, runs once, then gets deleted.
Recommend writing it as a one-shot `scripts/migrate-yaml.mjs` that
reads the existing YAML and emits the JSON5 entries; review the
output as a regular code review.

---

## 6. Test plan

- Existing TS compile passes against the contracts package's
  `DeviceRegistry` shape (with `satisfies` on the imported JSON).
- Existing rasterizer fixtures still produce identical bytes (the
  rasterizer is reading the same `headDots` value, just from a
  different path).
- Existing transport tests still find their devices (resolution
  reads `transports.usb.{vid,pid}` instead of top-level).
- WebUSB filter generation produces the same set as before.
- The validator catches malformed entries (missing `engines`,
  unknown `protocol`, malformed `vid`).
- The Duo, with only `lw-450` registered in `PROTOCOLS`, resolves
  to `engines.label.drivable === true` and
  `engines.tape.drivable === false`.
- The Twin Turbo, with `lw-450` registered, resolves to both
  engines drivable. `printer.print(image, media)` with no `engine`
  defaults to firmware-auto; `printer.print(image, media, { engine: 'left' })`
  routes through `bind.address: 0`.

---

## 7. Sequencing

1. **Land contracts schema** — prerequisite. The contracts package
   exports `PrintEngine`, `DeviceTransports`, `DeviceSupport`,
   `DeviceEntry`, `DeviceRegistry`, helpers. No driver edits yet.
2. **JSON5 + compile script** — add `data/devices/`, one JSON5
   file per device hand-ported from the existing `DEVICES` constant,
   plus the compile script and the build wiring. The in-source
   `DEVICES` re-exports from the compiled aggregated JSON. CI
   passes; runtime behavior unchanged.
3. **Migrate `hardware-status.yaml` inline** — fold support data
   into the JSON5 entries. Update the validator. Delete the YAML.
4. **Promote engines / transports** — restructure each entry to
   the new shape. Migrate the rasterizer + transport-resolution
   call sites to read from the new paths. Drop `bytesPerRow` from
   the entries (computed from `engine.headDots / 8`).
5. **Add Duo + Twin Turbo entries** — using their final
   `engines[]` shape. Duo's tape engine is `drivable: false`
   until `d1-tape` ships. Twin Turbo's protocol gains the
   address-prefix rule.
6. **Add 300-series entries** — using `transports.serial`.
7. **Cleanup** — remove the subsumed backlog plans (move to
   `implemented/` or delete), reduce `docs/hardware.md` to a
   one-line pointer.

Steps 2 and 3 are independent of 4–6 and can land separately.
Steps 4–6 should land as one batch — the shape change is global
and a partial-shape repo is harder to review than the whole
migration in one PR.
