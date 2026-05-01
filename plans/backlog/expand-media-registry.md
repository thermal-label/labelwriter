# labelwriter — Expand media registry

> Add the missing Dymo LabelWriter consumables to `MEDIA`, sourced from
> Dymo's own per-printer compatibility matrix
> (`dymo-labels-lw.pdf`, archived at the repo root). The immediate
> trigger is the upcoming 5XL field test: the most common 5XL roll
> (4×6 shipping, SKU `1744907`) is not in the registry today, so
> `detectedMedia` will return `undefined` even if the 550 status parser
> is byte-perfect.
>
> Discovery is essentially done: the PDF is treated as the canonical
> media list for this iteration, extracted into
> [`media-registry.csv`](./media-registry.csv). What remains is
> mechanical: port the CSV into typed entries, audit the six existing
> entries, write tests, ship docs.
>
> **Schema work has landed via
> [migrate-to-contracts-shape.md](./migrate-to-contracts-shape.md).**
> The contracts `MediaDescriptor` shape now carries `skus`, `category`,
> and `targetModels` (matched against `PrintEngine.mediaCompatibility`).
> No further `LabelWriterMedia` extension is needed — §2 below is
> historical context. The residual work is purely catalogue
> population (§3 onwards).

---

## 1. Goals & non-goals

**Goals**
- Cover every Dymo-branded LabelWriter consumable listed in
  `dymo-labels-lw.pdf` (the matrix Dymo publishes for the 5XL, 550,
  550 Turbo, 450 Twin Turbo, 450 Duo, 450, 450 Turbo, 4XL, and Wireless).
- Cover the D1 cartridge lineup the 450 Duo's tape head accepts,
  sourced from `dymo-labels-lm.pdf` (Dymo's LabelManager matrix —
  same D1 product line) and cross-checked against the LW PDF's 450 Duo
  column. Capture material (standard / permanent-polyester /
  flexible-nylon / durable) and the **background + text colours** so
  the preview/editor UI can render a predictable swatch.
- Map each entry to its Dymo SKU(s). Both PDFs together give us US
  5-digit (`30321`), US 7-digit (`1744907`) and EU S-numbers
  (`S0720780`); merge regional variants of one physical product onto
  a single entry.
- Make the 550 `detectedMedia` lookup succeed for every common roll a
  user is likely to load on a 550 / 550 Turbo / 5XL.
- Audit and correct the existing six entries in
  `packages/core/src/media.ts` against the PDF — the audit table in §3
  shows that all six need attention.
- Keep the `findMediaByDimensions` lookup deterministic — no two
  entries with the same `(widthMm, heightMm)` pair.

**Non-goals**
- Per-printer compatibility matrix in code. The PDFs list which SKUs
  ship for which printer, but in practice almost every paper roll
  fits every paper printer and every D1 tape fits every D1-capable
  printer. The only meaningful paper split is 4×6 being wide-head
  only (4XL/5XL); the only meaningful tape split is 24 mm being
  Duo/large-LM only. We surface both with a `targetModels` field
  and don't model the rest.
- Third-party / non-Dymo consumables. They cannot trigger the 550 NFC
  lock anyway, so registry coverage adds no value there.
- Cross-repo unification of the D1 registry with the sibling
  `labelmanager` package's existing `LabelManagerMedia` registry —
  see `plans/backlog/unify-device-registry.md`. This plan ports the
  D1 catalog into the LW repo to unblock Duo preview/editor work;
  unification follows.
- The 450 Duo's tape-side **protocol** path. The plan in
  `plans/backlog/duo-tape-support.md` covers wire-format and USB
  enumeration; here we only register the media the Duo accepts.
- Multi-ink palettes — D1 is single-ink (one foreground colour onto a
  fixed background). The schema captures both colours but the print
  pipeline still drives a single ink head.

---

## 2. Schema extension

The base `MediaDescriptor` has no SKU field
(`/contracts/dist/media.d.ts:54`). Extend `LabelWriterMedia` in
`packages/core/src/types.ts`:

```ts
export interface LabelWriterMedia extends MediaDescriptor {
  type: 'die-cut' | 'continuous';
  /** Length in 300-dpi dots — used by the 550 to match status responses. */
  lengthDots?: number;
  /**
   * Dymo retail SKUs for this media. Includes both the 5-digit legacy
   * codes (e.g. '30321') and 7-digit newer codes (e.g. '1744907') as
   * they appear on the box. Variants of the same physical size
   * (standard, durable, clear, time-expiring, count-per-roll) collapse
   * onto one entry — every SKU that maps to the same (widthMm,
   * heightMm) belongs in this array.
   */
  skus?: readonly string[];
  /**
   * Printers this roll fits. Defaults to all LabelWriter models if
   * omitted. Set to `['4xl', '5xl']` for the 4×6 wide-head-only rolls.
   */
  targetModels?: readonly string[];
}
```

`skus` is `readonly string[]` rather than a richer object because the
only consumer is human (printed on docs / surfaced in
`thermal-label list-media`-style introspection). If we later want
region tagging or per-SKU metadata (count-per-roll, durable flag) we
can promote it without breaking callers.

`id` stays kebab-case-by-size (`'shipping-4x6'`), not SKU-based — IDs
are the registry's stable handle, SKUs are catalogue metadata.

---

## 3. Audit existing entries

The six current entries in `packages/core/src/media.ts`, validated
against `dymo-labels-lw.pdf`:

| Entry | PDF says | Action |
| --- | --- | --- |
| `ADDRESS_STANDARD` 28×89 | `30251`/`30252`/`30254`/`30320`/`30340` all listed at `1 1/8 x 3 1/2"`. | Keep dimensions; populate `skus`. (`28.575 mm` rounds to 29; Dymo brands it as 28 — keep 28 to match the box.) |
| `ADDRESS_LARGE` 36×89 | `30321` at `1 4/10 x 3 1/2"`. | Keep dimensions; populate `skus: ['30321']`. |
| `SHIPPING_STANDARD` 59×102 | The 59×102 size is `30256`/`1763982` (Large Shipping). The 54×102 size is `30323` (Shipping). The current entry conflates them. | Rename → `SHIPPING_LARGE` (59×102, `skus: ['30256','1763982','1933088']`). Add a new `SHIPPING_STANDARD` (54×102, `skus: ['30323']`). |
| `SHIPPING_LARGE` 102×159 | No 102×159 in PDF. Standard 5XL 4×6 is 102×152 (`1744907`/`1933086`). 159 mm appears to be a typo for 152 mm (6.0", not 6.26"). | Rename → `SHIPPING_4X6`, dimensions 102×152, `targetModels: ['4xl','5xl']`. |
| `FILE_FOLDER` 19×87 | `30327` is `9/16 x 3 7/16"` = **14×87**. No 19×87 SKU exists. | Change to 14×87, `skus: ['30327']`. |
| `CONTINUOUS_56MM` 56 mm | `30270` continuous tape is `2 1/4"` = **57 mm**. | Rename → `CONTINUOUS_57MM`, width 57 mm, `skus: ['30270']`. |

Each correction is a behaviour change for downstream consumers —
call them out individually in the changelog (D-block in
`DECISIONS.md`).

---

## 4. New entries

Source data is `plans/backlog/media-registry.csv`, derived 1:1 from
`dymo-labels-lw.pdf`. 24 unique entries by physical dimension; the
audit-corrected entries from §3 are six of them, leaving 18 net new.

Per-category ordering for `media.ts`:

- **address** — return-address (19×51), address-standard (28×89,
  audit), address-large (36×89, audit)
- **shipping** — shipping-standard (54×102, audit), shipping-large
  (59×102, audit), shipping-4x6 (102×152, audit, 4XL/5XL only),
  lever-arch (59×190 durable)
- **file-folder** — file-folder (14×87, audit)
- **multi-purpose** — extra-small (13×25), square (25×25), small
  (25×54), medium (32×57), large (54×70), video-top (46×79),
  removable (51×59), shelving (25×89), appointment-card (51×89),
  book-spine (25×38)
- **barcode** — barcode-dymo-file (19×64)
- **name-badge** — name-badge (57×102), name-badge-non-adhesive
  (62×106)
- **price-tag** — price-tag (24×22), price-tag-2up (10×19, US only)
- **continuous** — continuous-57 (57 mm, audit)

`DEFAULT_MEDIA` stays pointed at `ADDRESS_STANDARD`.

`findMediaByDimensions` stays as-is — its contract doesn't change.

---

## 5. D1 cartridges (450 Duo tape head)

Source data: `dymo-labels-lm.pdf` (Dymo's LabelManager
compatibility matrix, archived at the repo root), cross-checked
against the 450 Duo column in `dymo-labels-lw.pdf`. Extracted to
`plans/backlog/media-registry-d1.csv` — 23 unique entries spanning
four material families:

- **D1 Standard** — paper-feel; backgrounds in white, clear, yellow,
  blue, green, red, black; text colours match the foreground entry.
  Widths: 6, 9, 12, 19, 24 mm.
- **D1 Permanent Polyester** — black on white, 12 mm.
- **D1 Flexible Nylon** — black on white, 12 mm.
- **D1 Durable** (industrial) — 12 mm; black-on-white,
  white-on-black, white-on-red, black-on-orange.

### 5.1 Schema

D1 tapes go in a separate `D1Cartridge` variant rather than
extending `LabelWriterMedia`, because they need fields the paper
schema doesn't (background/text colour, material) and don't need
fields it does (`heightMm`, `lengthDots`). Keeping them apart means
existing paper-only consumers (`findMediaByDimensions`, the 550
status parser) need no defensive type checks.

```ts
export type D1TapeColor =
  | 'white' | 'clear' | 'yellow' | 'blue'
  | 'green' | 'red' | 'black' | 'orange';

export type D1Material =
  | 'standard' | 'permanent-polyester' | 'flexible-nylon' | 'durable';

export interface D1Cartridge extends MediaDescriptor {
  type: 'cartridge';
  /** Physical tape width — 6 / 9 / 12 / 19 / 24 mm (1/4"–1"). */
  widthMm: 6 | 9 | 12 | 19 | 24;
  material: D1Material;
  /** Background colour of the tape — drives preview rendering. */
  background: D1TapeColor;
  /** Print colour. */
  text: D1TapeColor;
  skus?: readonly string[];
}
```

### 5.2 Colour mapping

Background/text colours are stored as a symbolic enum (`'yellow'`)
so consumers can render with their own palette. For UI consumers
that don't want to roll their own, export a canonical Dymo
brand-colour map:

```ts
export const D1_TAPE_COLOR_HEX: Record<D1TapeColor, string | null> = {
  white:  '#FFFFFF',
  clear:  null,        // transparent — render as checkerboard / surface
  yellow: '#FFD800',
  blue:   '#2680BD',
  green:  '#00A651',
  red:    '#E30613',
  black:  '#000000',
  orange: '#F39200',   // Durable Black on Orange only
};
```

Hex values approximate the swatches in `dymo-labels-lm.pdf`; tweak
in code review if the design team has authoritative brand values.

### 5.3 Registry placement

Exported as `D1_CARTRIDGES` from `packages/core/src/media.ts`
alongside the paper `MEDIA` registry. A dedicated lookup helper for
the Duo:

```ts
export function findD1ByWidth(widthMm: 6|9|12|19|24): readonly D1Cartridge[];
```

Returns every variant at that width — colour selection is a UI
concern, not a registry one.

### 5.4 SKU conflict to verify

The 19mm (3/4") tapes have inconsistent SKU labelling between the
two PDFs:

| LW PDF (450 Duo) | LM PDF (500TS et al.) |
| --- | --- |
| `45803` = Black on **Clear** 3/4" | `45803` = Black on **White** 3/4" |
| `45800` = Black on White 3/4" | `S0720820` = Black on Clear 3/4" |

Likely a typo in one. Verify against Dymo's product pages before
shipping; both 19mm rows in the CSV carry the conflict in `notes`.
Same flag for the LM 280 row that lists Permanent Black on White
under SKU `1978364` (the same SKU it lists for Durable Black on
White) — almost certainly a copy-paste error in the source PDF;
treat `16955` (per LW PDF and LM 360D) as authoritative.

### 5.5 Cross-repo overlap (informational)

The sibling `../labelmanager/packages/core` already has its own
`LabelManagerMedia` registry covering 6/9/12/19 mm tapes — no 24 mm,
no colour metadata, no material distinction. This plan does not
unify them; that lives in
`plans/backlog/unify-device-registry.md`. Either the Duo eventually
imports the LM registry, or the LM registry adopts the schema this
plan introduces. For now: the LW repo carries `D1_CARTRIDGES`
locally to unblock the Duo's preview/editor UI without waiting for
the unification work.

---

## 6. Device → media class mapping

For picking a label for a given printer, only one question matters:
**is the printer's `headDots` 672 or 1248?**

| Class | Devices (`headDots`) | Supported paper media |
| --- | --- | --- |
| Standard (672-dot) | 450, 450 Turbo, 450 Twin Turbo, 450 Duo, 550, 550 Turbo, Wireless, and every other non-XL LabelWriter | 23 of 24 paper entries — everything except `shipping-4x6`. |
| Wide (1248-dot) | 4XL, 5XL | All 24 paper entries, including `shipping-4x6` (102×152). |

Plus one orthogonal axis: the **450 Duo** has a second slot taking
D1 cartridge tapes — enumerated in §5 / `D1_CARTRIDGES`. The Duo is
the only LW model with this slot. The 24 mm (1") D1 width also has a
device split (large LMs and the Duo accept it; smaller LMs in the LM
PDF do not list 24 mm rows) — flagged on those entries via
`targetModels`.

The PDF's per-printer columns confirm this collapsing: every paper
SKU listed for the 5XL/4XL is also listed for every 672-dot printer,
*except* the two 4×6 SKUs (`1744907`, `1933086`). 62×106 name badge
(`30856`) ships for every printer even though 62 mm > the 672-dot
head's ~57 mm print width — Dymo prints with margins rather than
refusing the roll, so registry compatibility is governed by
*physical fit*, not print width.

What this implies for the implementation and docs:
- The `targetModels` schema field (§2) only needs to be set on
  `shipping-4x6` (and its durable variant if split out). Omitted =
  "fits every LabelWriter".
- A consumer asking "what fits my printer?" reduces to:
  ```ts
  const fits = (m: LabelWriterMedia, d: DeviceProfile) =>
    !m.targetModels || m.targetModels.includes(d.headDots === 1248 ? '4xl-5xl' : 'standard');
  ```
  No N×M lookup table needed.
- The docs page (§8.5) renders one table per category with a single
  "✓ all / 4XL+5XL only" column rather than a full printer matrix.
- Future devices (e.g. 300 series per
  `amendment-support-300-series.md`) inherit the standard class
  unless they introduce a third head width.

---

## 7. Manual investigation gaps

Items mentioned in the original plan / hinted by adjacent Dymo
documentation but **not present in `dymo-labels-lw.pdf`**. Park as
follow-ups; do not block this plan.

- **Round die-cut labels (1" / 25 mm round).** Mentioned in the
  original coverage checklist. Not in the PDF. Possibly third-party
  only, or in a separate "speciality" catalogue. Verify against
  dymo.com/labels before adding.
- **File-folder 12×87 (`30269`).** Original plan suspected this as an
  alternative to the 14×87. Not in the PDF — likely discontinued.
  Drop unless a real roll surfaces.
- **EU S-number SKUs for paper labels.** The LW PDF is Dymo US.
  Real EU boxes carry codes like `S0722400` / `S0722520` /
  `S0904980`. The LM PDF does cover EU S-numbers but only for D1
  tapes, not paper. Either: (a) source the EU equivalent of
  `dymo-labels-lw.pdf` and merge SKU lists onto existing entries by
  dimension, or (b) defer until an EU user reports a missed
  detection. Cheap to add later — the entry shape already supports
  `skus: readonly string[]` of mixed formats.
- **Glossy / coloured address-label variants.** The original plan
  mentioned these as candidates that "collapse to one entry with
  multiple SKUs". The PDF lists `30254` (Address Clear) but no
  glossy/coloured variants — likely a separate retail line, not in
  the compatibility matrix. Defer.

When any of these surfaces with a real SKU + dimension, add a row to
`media-registry.csv` and regenerate the registry/docs.

---

## 8. Implementation

Source-of-truth: `plans/backlog/media-registry.csv` (paper) and
`plans/backlog/media-registry-d1.csv` (D1 cartridges).

### 8.1 `packages/core/src/types.ts`

- Add `skus?: readonly string[]` and `targetModels?: readonly
  string[]` to `LabelWriterMedia` per §2.
- Add the `D1TapeColor`, `D1Material`, and `D1Cartridge` types per
  §5.1.
- Export `D1_TAPE_COLOR_HEX` per §5.2 (constant, not a type, so it
  may live in `media.ts` instead — wherever existing colour-adjacent
  code already sits).

### 8.2 `packages/core/src/media.ts`

- Re-derive every `MEDIA` entry from `media-registry.csv`. Group by
  category in the order from §4. Within a category, sort by
  ascending `widthMm`.
- Add `D1_CARTRIDGES` from `media-registry-d1.csv`. Group by
  material (standard, then permanent-polyester, flexible-nylon,
  durable). Within standard, sort by `widthMm` then by background
  colour.
- Add `findD1ByWidth(widthMm)` per §5.3.

Naming for paper: `MEDIA.SHIPPING_4X6`, `MEDIA.MULTI_PURPOSE_25X54`,
`MEDIA.NAME_BADGE_62X106`, etc. Naming for D1:
`D1_CARTRIDGES.STANDARD_BLACK_ON_WHITE_12`,
`D1_CARTRIDGES.DURABLE_BLACK_ON_ORANGE_12`, etc. (verbose but
self-describing; the registry is read mostly by docs generators
and UI dropdowns, not by hand).

The audit renames from §3 apply (`SHIPPING_STANDARD` →
`SHIPPING_LARGE` + new `SHIPPING_STANDARD`, `SHIPPING_LARGE` →
`SHIPPING_4X6`, `CONTINUOUS_56MM` → `CONTINUOUS_57MM`). No
back-compat shims — pre-1.0, no external consumers.

### 8.3 `packages/core/src/__tests__/media.test.ts`

Coverage to add:
- For every paper entry: `findMediaByDimensions(widthMm, heightMm!)`
  returns that entry (catches duplicate-dimension bugs at unit-test
  time).
- For every paper entry with a `lengthDots`: it equals
  `Math.round(heightMm * 11.81)` ± 1 (catches arithmetic regressions).
- For every paper entry's `skus`: each SKU matches
  `/^\d{5}$|^\d{7}$/` (the two formats the LW PDF uses).
- For every D1 entry's `skus`: each SKU matches
  `/^\d{5}$|^\d{7}$|^S\d{7}$/` (LW + LM PDFs combined).
- For every D1 entry: `findD1ByWidth(widthMm)` includes it, and
  `(material, background, text)` is unique within a width.
- `MEDIA` and `D1_CARTRIDGES` keys form one-to-one mappings with
  their `id` values.
- `defaultOrientation === 'horizontal'` iff
  `(heightMm ?? 0) >= 2 * widthMm` (sanity check — auto-rotate only
  makes sense for elongated die-cut).
- `D1_TAPE_COLOR_HEX` covers every value of `D1TapeColor` (exhaustive
  enum coverage).

### 8.4 `packages/core/src/__tests__/status.test.ts`

Add one parameterised case per **5XL-relevant** paper entry: feed a
synthetic 32-byte response with that entry's `widthMm` / `heightMm`
at bytes 4-7, assert `detectedMedia` resolves to the same entry.
This locks in the registry-status integration we care about for the
field test. D1 cartridges have no status-byte path on the LW (the
Duo's tape side is a separate USB interface; status parsing for it
is out of scope here).

### 8.5 Documentation

The current public-facing media reference is six lines of code-block
comments in `docs/node.md:106-111` — embeds the suspect dimensions
(`102×159`, `19×87`, `56mm`) the audit flags as wrong. Fixing the
registry without fixing this is half the job.

**New page: `docs/media.md` — "Supported labels"**

Generated from the registries (or from the CSVs), not hand-written.
Contents:

- Short intro: how detection works (550-series only, NFC lock
  implication, fallback to `DEFAULT_MEDIA` when unrecognised).
- **Paper labels** — one table per category (address, shipping,
  file-folder, multi-purpose, name-badge, barcode, price-tag,
  continuous). Columns: registry key, dimensions (mm and inches),
  Dymo SKU(s), 4XL/5XL-only flag where applicable.
- **D1 cartridges (450 Duo)** — one table per material (Standard,
  Permanent Polyester, Flexible Nylon, Durable). Columns: registry
  key, width (mm and inches), background colour swatch, text colour,
  Dymo SKU(s) (US + EU), Duo-only / 24mm flag.
- A "Custom sizes" section showing how to construct a
  `LabelWriterMedia` literal for a non-Dymo or unlisted roll, with a
  note that custom sizes won't auto-detect on the 550.
- Link to the archived PDFs (`dymo-labels-lw.pdf`,
  `dymo-labels-lm.pdf`) for users who want to verify dimensions or
  SKUs themselves.

A small `scripts/build-media-doc.mjs` reads the registries and emits
the page; runs in CI to detect drift between code and docs. The
colour-swatch column uses `D1_TAPE_COLOR_HEX` so docs and UI render
identically.

**Other doc updates**
- `docs/node.md:106-111` — replace the 6-line code-block list with a
  one-line "see [Supported labels](./media)" pointer.
- `docs/hardware.md` — keep device-only; cross-link to `media.md`.
- `docs/verification-checklist.md` — extend step 7 (or add 7a) to
  instruct the tester to record the SKU printed on the roll-end
  sticker alongside the `rawBytes` capture.
- `DECISIONS.md` — add a `D9 — Media registry SKU coverage` entry
  documenting the rationale (PDF as canonical source, dimension
  collapse, 5-digit + 7-digit SKU format, EU S-numbers deferred) and
  listing the six audit corrections.
- VitePress sidebar (`docs/.vitepress/config.*`) — add `media.md`
  between Hardware and Verification checklist.

### 8.6 Version bump

Additive change with several semver-minor breakages (audit
corrections to existing paper dimensions and key renames; new D1
type surface). Bump core `0.3.0 → 0.4.0` and re-export from node +
web with the same bump.

---

## 9. Phasing

1. ~~**Research**~~ — done. PDFs archived as `dymo-labels-lw.pdf`
   and `dymo-labels-lm.pdf` at the repo root; extracted to
   `plans/backlog/media-registry.csv` and
   `plans/backlog/media-registry-d1.csv`.
2. **Paper schema** — add `skus` and `targetModels` fields to
   `LabelWriterMedia`. One-line change; lands first so the registry
   PR doesn't conflate schema and data.
3. **Paper audit corrections** — fix the six existing entries per §3
   (dimension corrections, renames, SKU population). Tests only, no
   new entries. Isolated PR for honest changelog.
4. **New paper entries** — port the remaining 18 CSV rows into
   `media.ts`. Pure additive; trivial review.
5. **D1 schema + registry** — add `D1Cartridge`, `D1TapeColor`,
   `D1Material`, `D1_TAPE_COLOR_HEX`, `D1_CARTRIDGES`,
   `findD1ByWidth`. Independent of the paper PRs; can land in
   parallel with phases 3–4.
6. **Docs + version bump** — `media.md` generation (paper + D1
   tables), sidebar entry, `DECISIONS.md` D9, package bumps.

Phases 2–6 are an afternoon plus an evening for D1 (the schema is
new but mechanical).

---

## 10. Field-test interlock

The 5XL test next weekend does **not** block this plan, but it
informs it:

- **Before the test:** at minimum, finish phases 2–3 and add the
  4×6 shipping entry (`SHIPPING_4X6`, 102×152, `skus:
  ['1744907','1933086']`, `targetModels: ['4xl','5xl']`). That's the
  single highest-value addition for the test itself.
- **Tester captures we need from the field test:**
  - Roll-end sticker photo (SKU + barcode).
  - Box-back photo (full SKU table).
  - `thermal-label status` `rawBytes` with that roll loaded.
  - Repeat for every roll they have on hand.
- **After the test:** the captured `rawBytes` give us the *first
  real-hardware sample* of a 550 status response. Reconcile against
  the registry: if `widthMm` / `heightMm` parsed from bytes 4-7
  matches the SKU's catalogued dimensions, the parser is validated;
  if not, the `parseStatus550` byte layout in
  `packages/core/src/status.ts:49-73` needs revising and the registry
  is fine.

---

## 11. Decisions locked in

- **PDFs as canonical for v1.** `dymo-labels-lw.pdf` (paper) and
  `dymo-labels-lm.pdf` (D1 tapes) are Dymo's own per-printer
  compatibility matrices — treat as authoritative. Gaps (round
  labels, EU S-numbers for paper, glossy variants, the 19mm SKU
  conflict) are enumerated in §5.4 / §7 and deferred, not silently
  dropped.
- **`skus` is optional.** Best-effort population: catalogued Dymo
  consumables get one or more SKUs, custom/user-constructed media
  values pass without faking a SKU.
- **SKU variants of the same physical product collapse to one
  entry.** The `skus` array holds every SKU Dymo ships at that
  (widthMm, heightMm) for paper or (material, widthMm, background,
  text) for D1 — count-per-roll variants, durable variants, clear
  stock, time-expiring, regional twins (US 5-digit / 7-digit + EU
  S-number). The `name` field stays human-descriptive
  (`"89×36mm Large Address"`, `"12mm Black on Yellow"`); SKU is a
  secondary lookup index.
- **Per-printer compatibility is not modelled in code.** Only the
  4×6 wide-head-only paper constraint and the 24mm tape constraint
  surface, via `targetModels`. The rest of the matrix is
  informational and lives in the PDFs.
- **D1 colours are symbolic, not hex.** The schema stores
  `'yellow'`, not `'#FFD800'`. UI consumers map via
  `D1_TAPE_COLOR_HEX` (or their own palette) — keeps the registry
  brand-neutral and makes design refreshes a one-constant change.
- **D1 lives in its own registry, not folded into `MEDIA`.** Keeps
  paper-only consumers (`findMediaByDimensions`, 550 status parser)
  type-clean and avoids forcing every consumer to discriminate on
  `type`.

---

## 12. Open questions

- **Continuous-tape `lengthDots`.** Currently undefined. The 550
  status response will report `heightMm: 0` for continuous; the
  registry match needs to handle that case explicitly (it does today
  via the `widthMm > 0` guard, but the test in §8.4 should cover
  continuous explicitly to lock the behaviour in).
- **Lever Arch / Confirmation duplicate naming.** LW PDF lists SKU
  `1933087` under both "Large Lever Arch (Durable)" and
  "Confirmation (Durable)" with identical dimensions (`2 5/16 x 7
  1/2"`). Same physical product, two marketing names. Pick one for
  `name`; record both in a comment.
- **19mm D1 SKU labelling (§5.4).** Verify against Dymo product
  pages whether `45803` is Black on White or Black on Clear before
  shipping; the two PDFs disagree.
- **Brand-colour hex values.** The values in `D1_TAPE_COLOR_HEX` are
  approximations from PDF swatches. If Dymo publishes official
  brand-guideline hex, swap them in.
