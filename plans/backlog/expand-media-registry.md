# labelwriter — Expand media registry

> Add the missing Dymo LabelWriter consumables to `MEDIA`, anchored on
> the consumer-facing Dymo S-numbers (and the legacy 5-digit "30xxx"
> SKUs where they are the dominant identifier in a given region). The
> immediate trigger is the upcoming 5XL field test: the most common
> 5XL roll (4×6 shipping) is not in the registry today, so
> `detectedMedia` will return `undefined` even if the 550 status parser
> is byte-perfect.
>
> This plan has two halves: a **data-collection phase** that produces
> a single source-of-truth spreadsheet, and an **implementation phase**
> that ports that spreadsheet into typed entries with tests.

---

## 1. Goals & non-goals

**Goals**
- Cover every Dymo-branded LabelWriter consumable currently sold in
  the US and EU retail channels.
- Map each entry to its consumer-facing Dymo S-number (e.g.
  `S0722400`) and, where applicable, its legacy 5-digit SKU
  (e.g. `30321`). Both are useful — users find labels in the wild by
  either.
- Make the 550 `detectedMedia` lookup succeed for every common roll a
  user is likely to load on a 550 / 550 Turbo / 5XL.
- Audit and (if needed) correct the existing six entries in
  `packages/core/src/media.ts` — at least one (`FILE_FOLDER` at
  19×87 mm) does not match any Dymo-catalogued size and needs
  verification.
- Keep the `findMediaByDimensions` lookup deterministic — no two
  entries with the same `(widthMm, heightMm)` pair.

**Non-goals**
- Third-party / non-Dymo consumables. They cannot trigger the 550 NFC
  lock anyway, so registry coverage adds no value there.
- Tape-format media for the 450 Duo's D1 cartridge (out of scope per
  `plans/implemented/initial-buildout.md`).
- Multi-ink palettes — all LabelWriter media is single-ink black.

---

## 2. Schema extension

The base `MediaDescriptor` has no SKU field (`/contracts/dist/media.d.ts:54`).
Extend `LabelWriterMedia` in `packages/core/src/types.ts`:

```ts
export interface LabelWriterMedia extends MediaDescriptor {
  type: 'die-cut' | 'continuous';
  /** Length in 300-dpi dots — used by the 550 to match status responses. */
  lengthDots?: number;
  /**
   * Dymo retail SKUs for this media. The S-number (e.g. 'S0722400') is
   * the modern consumer-facing identifier; the 5-digit code (e.g.
   * '30321') is the legacy SKU still printed on most US boxes. List
   * every variant that ships in this exact dimension — regional twins
   * (US '30321' / EU 'S0722400') belong on one entry, not two.
   */
  skus?: readonly string[];
}
```

`skus` is `readonly string[]` rather than a richer object because the
only consumer is human (printed on docs / surfaced in
`thermal-label list-media`-style introspection). If we later want
region tagging we can promote it without breaking callers.

`id` stays kebab-case-by-size (`'shipping-4x6'`), not SKU-based — IDs
are the registry's stable handle, SKUs are catalogue metadata.

---

## 3. Data collection

This is the load-bearing phase. The goal is a single spreadsheet
(`plans/backlog/media-registry.csv`, committed) that the implementation
phase reads top-to-bottom. Doing the research up front, once, beats
discovering off-by-1mm sizes during PR review.

### 3.1 Sources, in priority order

1. **Dymo's official media catalogue PDF** — published per region
   (US, EU/UK). Authoritative for dimensions, SKUs, label-count per
   roll. URL changes over time; find the current one via
   `dymo.com/labels` then archive a copy under `plans/backlog/sources/`.
2. **Product pages on dymo.com** — for each S-number, the spec sheet
   gives dimensions in both inches and mm. Inches are the source of
   truth (Dymo designs in imperial); mm values on the page are
   sometimes rounded inconsistently (e.g. 2-1/8" rendered as both
   54 mm and 59 mm depending on the page).
3. **Roll-end stickers / box backs** — physical confirmation. The
   tester running the 5XL next weekend should photograph the roll-end
   and box for any roll they load; this lets us cross-check SKU →
   dimensions mapping for at least one real-world sample.
4. **Dymo Connect / Dymo Label software** — the desktop apps ship a
   media database. Useful as a third opinion when a Dymo PDF and
   product page disagree.

When sources disagree, **resolve to the inch dimension Dymo prints on
the box** and round to the nearest mm using `mm = round(in * 25.4)`.
Document the disagreement in a `notes` column on the spreadsheet so
future maintainers know the field was contested.

### 3.2 Spreadsheet columns

For each candidate entry:

| Column | Notes |
| --- | --- |
| `id` | Proposed kebab-case registry key (e.g. `shipping-4x6`). |
| `category` | `address` / `shipping` / `file-folder` / `multi-purpose` / `name-badge` / `barcode` / `round` / `continuous`. Drives ordering in `media.ts` and grouping in docs. |
| `widthInches` / `heightInches` | Source-of-truth inch values from Dymo. `heightInches` blank for continuous. |
| `widthMm` / `heightMm` | Computed from inches, rounded. The values that go into the registry. |
| `lengthDots` | `round(heightMm * 11.81)` for die-cut. Blank for continuous. |
| `skuS` | S-number(s), comma-separated if multiple regional variants. |
| `sku5digit` | Legacy 5-digit SKU(s), comma-separated. |
| `defaultOrientation` | `horizontal` for elongated die-cut (long axis ≥ 2× short axis), blank otherwise. |
| `cornerRadiusMm` | 3 mm for standard rounded-corner address/shipping; full-radius (`widthMm/2`) for round die-cut; blank for square corners or continuous. |
| `printMargins` | `1.5/1.5/1.5/1.5` for shipping & address per Dymo design guide; blank otherwise. |
| `targetModels` | Which devices this roll fits — `all`, `4xl/5xl-only` (wide-head), or `non-5xl` (narrow-head). 5XL-only rolls are wider than 63 mm. |
| `regions` | `US`, `EU`, or `both`. |
| `notes` | Source disagreements, deprecation status (Dymo has retired some 30xxx SKUs in favour of S-numbers), special handling. |

### 3.3 Coverage targets

The collection is "thorough enough" when we have rows for **every Dymo
S-number currently listed on dymo.com/labels**, in both US and EU
catalogues. Concrete sub-checklist (use this to grade the spreadsheet
before moving to phase 4):

- [ ] All address labels (28×89, 36×89, plus any glossy / coloured /
      durable variants that share dimensions — those collapse to one
      entry with multiple SKUs).
- [ ] All shipping labels (54×101, 59×102, **102×152 — the 5XL one**,
      and any long-format internet-postage variants).
- [ ] All file-folder labels (verify the existing 19×87 — most likely
      it should be 14×87 mm matching `30327`/`S0722460`).
- [ ] All multi-purpose labels — 25×25, 25×54, 32×57, 13×25 etc.
- [ ] All name-badge / visitor labels (62×106, 59×102 name-badge
      variants).
- [ ] Round die-cut labels (1" round = 25 mm).
- [ ] Barcode-specific labels.
- [ ] Continuous rolls in every width Dymo ships (19 mm, 28 mm, 36 mm,
      54 mm, 57 mm — the existing 56 mm CONTINUOUS_56MM is suspicious
      and should be reconciled).
- [ ] **5XL/4XL-specific wide rolls** beyond the 4×6 shipping one
      (warehouse, durable, extended-length variants).

### 3.4 Audit existing entries

Before adding new rows, validate the six existing entries. Suspected
issues to confirm or refute via the same sources:

| Entry | Suspected issue | What to verify |
| --- | --- | --- |
| `ADDRESS_STANDARD` 28×89 | Likely correct. | Confirm SKUs `S0722520` / `30252` / `99010`. |
| `ADDRESS_LARGE` 36×89 | Likely correct. | Confirm SKUs `S0722400` / `30321` / `99012`. |
| `SHIPPING_STANDARD` 59×102 | Width is suspect — `30323` is 54×101, not 59×102. The 59×102 size matches `30256`. Possibly two entries collapsed into one. | Resolve which SKU this row represents; split if needed. |
| `SHIPPING_LARGE` 102×159 | Length is suspect — the standard 5XL roll is 102×**152**, not 159. 159 mm = 6.26", which is non-standard. Possibly a typo for 6". | Confirm the source; the new `SHIPPING_4X6` (102×152) likely supersedes this. |
| `FILE_FOLDER` 19×87 | Width is suspect — Dymo's file-folder labels are 14×87 (`30327`/`S0722460`) or 12×87 (`30269`). 19×87 matches no catalogued SKU. | Almost certainly needs to become 14×87 with SKU populated. |
| `CONTINUOUS_56MM` 56 mm | Width is suspect — Dymo continuous tape is 57 mm (2-1/4"), not 56 mm. | Likely a rounding error; should be 57 mm. |

Each correction is a behaviour change for downstream consumers — call
them out individually in the changelog (D-block in `DECISIONS.md`).

---

## 4. Implementation

Once the spreadsheet is signed off, implementation is mechanical.

### 4.1 `packages/core/src/types.ts`

Add the `skus?: readonly string[]` field to `LabelWriterMedia` per
section 2. No other changes.

### 4.2 `packages/core/src/media.ts`

Re-derive every `MEDIA` entry from the spreadsheet. Group entries by
category in source order: address → shipping → file-folder →
multi-purpose → name-badge → round → barcode → continuous. Within a
category, sort by ascending `widthMm`.

Naming: `MEDIA.SHIPPING_4X6`, `MEDIA.MULTI_PURPOSE_25X54`,
`MEDIA.ROUND_25MM`, `MEDIA.NAME_BADGE_62X106`, etc. Existing keys
(`ADDRESS_STANDARD`, `ADDRESS_LARGE`, `SHIPPING_STANDARD`,
`SHIPPING_LARGE`, `FILE_FOLDER`, `CONTINUOUS_56MM`) stay as aliases or
get renamed:

- If the existing entry's dimensions were correct, keep the key.
- If they were wrong (per audit), rename — e.g. `CONTINUOUS_56MM` →
  `CONTINUOUS_57MM`. Add a `// removed: …` is **not** appropriate per
  the repo's no-shim rule; just rename. This is pre-1.0 and there are
  no external consumers.

`DEFAULT_MEDIA` stays pointed at `ADDRESS_STANDARD`.

`findMediaByDimensions` stays as-is — its contract doesn't change.

### 4.3 `packages/core/src/__tests__/media.test.ts`

Coverage to add:
- For every entry: `findMediaByDimensions(widthMm, heightMm!)` returns
  that entry (catches duplicate-dimension bugs at unit-test time).
- For every entry with a `lengthDots`: it equals
  `Math.round(heightMm * 11.81)` ± 1 (catches arithmetic regressions).
- For every entry with `skus`: every SKU matches one of the patterns
  `S\d{7}` (S-number) or `\d{5}` (legacy) or `\d{5}[A-Z]?` (rare
  variants).
- `MEDIA` keys form a one-to-one mapping with `id` values (no two
  entries share an `id`).
- `defaultOrientation === 'horizontal'` iff
  `(heightMm ?? 0) >= 2 * widthMm` (sanity check — the
  auto-rotate heuristic only makes sense for elongated die-cut).

### 4.4 `packages/core/src/__tests__/status.test.ts`

Add one parameterised case per **5XL-relevant** entry: feed a
synthetic 32-byte response with that entry's `widthMm` / `heightMm` at
bytes 4-7, assert `detectedMedia` resolves to the same entry. This
locks in the registry-status integration we care about for the field
test.

### 4.5 Documentation

The current public-facing media reference is six lines of code-block
comments in `docs/node.md:106-111`. That's the only place a user can
look up "what rolls are supported" — and it embeds the suspect
dimensions (`102×159`, `19×87`, `56mm`) the audit flags as wrong, so
it ships the same incorrect values as `media.ts`. Fixing the registry
without fixing this is half the job.

**New page: `docs/media.md` — "Supported labels"**

A dedicated reference page, linked from the docs sidebar between
`hardware.md` and `verification-checklist.md`. Not a code reference
(that stays in `node.md` / API docs); this is the page a user Ctrl-Fs
when they're staring at a label box and want to know whether the
driver will recognise it.

Contents:
- Short intro paragraph: how detection works (550-series only, NFC
  lock implication, fallback to `DEFAULT_MEDIA` when unrecognised).
- One table per category (address, shipping, file-folder,
  multi-purpose, name-badge, round, barcode, continuous). Columns:
  registry key, dimensions (mm and inches), Dymo SKU(s), 5XL/4XL-only
  flag where applicable. Rendered from the same source-of-truth
  spreadsheet from phase 1, so dimensions can never drift between
  docs and code (write a small `scripts/build-media-doc.mjs` that
  emits the page from `media.ts` — runs in CI to detect drift).
- A "Custom sizes" section showing how to construct a
  `LabelWriterMedia` literal for a non-Dymo roll, with a note that
  custom sizes won't auto-detect on the 550 (they're not in the
  registry).
- Link to the archived vendor PDFs under `plans/backlog/sources/` for
  users who want to verify dimensions themselves.

**Other doc updates**
- `docs/node.md:106-111` — replace the 6-line code-block list with a
  one-line "see [Supported labels](./media)" pointer. Stops the
  duplicate from drifting.
- `docs/hardware.md` — keep device-only; cross-link to `media.md` from
  the intro ("for supported label rolls, see Supported labels").
- `docs/verification-checklist.md` — extend step 7 (or add step 7a)
  to instruct the tester to record the SKU printed on the roll-end
  sticker alongside the `rawBytes` capture.
- `DECISIONS.md` — add a `D9 — Media registry SKU coverage` entry
  documenting the rationale (regional twins collapse to one entry,
  inches as source of truth) and listing any audit corrections that
  changed dimensions for existing entries.
- `HARDWARE.md` — no change; it already points at `docs/`.

**Sidebar / nav**
- VitePress sidebar config (likely `docs/.vitepress/config.*`) needs
  a new entry for `media.md`. Order: Hardware → Supported labels →
  Verification checklist.

### 4.6 Version bump

This is an additive change with one or two semver-minor breakages
(audit corrections to existing dimensions). Bump core `0.3.0 → 0.4.0`
and re-export from node + web with the same bump.

---

## 5. Phasing

The work breaks into clean phases that can land as separate PRs:

1. **Research** — produce `plans/backlog/media-registry.csv` +
   archived source PDFs under `plans/backlog/sources/`. No code
   changes. Output is reviewable on its own merits.
2. **Schema** — add the `skus` field to `LabelWriterMedia`. One-line
   change; lands first so the registry PR doesn't conflate schema and
   data.
3. **Audit corrections** — fix the six existing entries against the
   spreadsheet (dimension corrections, SKU population). Tests only,
   no new entries. This is the breaking part of the work; isolating
   it makes the diff small and the changelog honest.
4. **New entries** — port the rest of the spreadsheet into
   `media.ts`. Pure additive; trivial review.
5. **Docs + version bump** — `hardware.md` table, verification
   checklist tweak, `DECISIONS.md` D9, package bumps.

Phase 1 is the bottleneck (a few hours of careful catalogue work);
phases 2-5 are an afternoon.

---

## 6. Field-test interlock

The 5XL test next weekend does **not** block this plan, but it
informs it:

- **Before the test:** at minimum, finish phases 1-3 and add the
  4×6 shipping entry (`SHIPPING_4X6`, 102×152, `S0904980` /
  `1744907`). That's the single highest-value addition for the test
  itself.
- **Tester captures we need from the field test:**
  - Roll-end sticker photo (SKU + barcode).
  - Box-back photo (full SKU table).
  - `thermal-label status` `rawBytes` with that roll loaded.
  - Repeat for every roll they have on hand.
- **After the test:** the captured `rawBytes` give us the *first
  real-hardware sample* of a 550 status response. Reconcile it
  against the registry: if `widthMm` / `heightMm` parsed from bytes
  4-7 matches the SKU's catalogued dimensions, the parser is
  validated; if not, the `parseStatus550` byte layout in
  `packages/core/src/status.ts:49-73` needs revising and the registry
  is fine.

---

## 7. Decisions locked in

- **`skus` is optional.** Best-effort population: catalogued Dymo
  rolls get one or more, custom/user-constructed `LabelWriterMedia`
  values pass without faking a SKU.
- **Regional twins collapse to one entry.** The `skus` array holds
  every regional variant (US 5-digit + EU S-number) for the same
  physical dimensions. The `name` field stays dimension-based
  (`"89×36mm Large Address"`), so no region-aware display logic is
  needed in any consumer — frontend, CLI, or docs. Users find their
  roll by dimension; the SKU array is a secondary lookup index for
  "I have box `30321` in my hand, is it supported?" queries.

## 8. Open questions

- **Continuous-tape `lengthDots`.** Currently undefined. The 550
  status response will report `heightMm: 0` for continuous; the
  registry match needs to handle that case explicitly (it does today
  via the `widthMm > 0` guard, but the test in phase 4.4 should cover
  continuous explicitly to lock the behaviour in).
