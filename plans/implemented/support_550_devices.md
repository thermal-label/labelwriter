# LabelWriter 550 series — protocol gap analysis

> **Implemented from spec**, hardware-verification still pending.
> The 550 path is now a clean fork of the 450 path: `encode550Label`
> in `packages/core/src/protocol-550.ts` emits the spec-correct
> print job structure (ESC s / ESC n / ESC D 12-byte header /
> ESC Q), `parseStatus550` reads the spec-correct 32-byte response
> (bay status / head voltage / SKU / error ID), the driver gained
> `getMedia()` (ESC U → SKU dump) and `getEngineVersion()` (ESC V),
> and `print()` acquires the print lock (ESC A 1) + surfaces
> printer-side errors (no media / jam / cover open / counterfeit /
> overheated / low voltage) before sending the job. `recover()` is
> protocol-aware (550 sends ESC Q; 450 keeps the legacy 87-byte
> sync-flush). 282 tests pass; the 550-only ones are 47 protocol
> tests + 14 driver tests. Two judgment calls baked into the
> implementation pending hardware confirmation: density `light/
> medium/normal/high` mapped to `70/85/100/130 %`, and `ESC L`
> omitted entirely (label length comes from the NFC tag for
> genuine media). Remaining gap: §5.3 mDNS auto-discovery —
> deferred, needs a `bonjour`/`mdns-js` dep. Move to
> `implemented/` once a real 550 confirms the byte stream
> rasterises correctly.

Cross-check of the original 550 driver against `LW 550 Technical Reference.pdf`
(LW 550 / 550 Turbo / 5XL, ©2021 Sanford). Conclusion at the time: the 550
path in `encodeLabel()` and `parseStatus550()` was largely a 450-shaped
pipeline with a `ESC s` job header bolted on. The 550 spec describes a
different print job shape, a different status response, and several mandatory
commands we never emitted. The driver did not produce a valid 550 job. All
items below are now addressed.

Severity tags: **[blocker]** = job will be rejected or misprint; **[bug]** =
wrong byte / wrong meaning; **[gap]** = unimplemented capability.

---

## 1. Print job structure (`encodeLabel`, `protocol.ts`)

The 550 job format per spec, section "Print Job Structure":

```
Print Job Header
  ESC s <jobID:u32>                       (mandatory)
  ESC L <len>                             (optional — see §3)
  ESC h | ESC i                           (optional — text vs graphics)
  ESC T <speedMode>                       (optional — Normal 0x10 / High 0x20)
  ESC C <duty:u8>                         (optional — 0..200 %)
  ESC q <trayId>                          (optional — Twin Turbo only)

Per label (repeat 1..N):
  ESC n <index:u32>                       (mandatory)
  ESC D <bpp:u8> <align:u8> <width:u32> <height:u32> <data...>
                                          (mandatory; data length = ceil(height*bpp/8) * width)
  ESC G                                   (between labels, mandatory choice)
  ESC E                                   (last label / tear-off, mandatory choice)

Print Job Trailer
  ESC Q                                   (mandatory)
```

What `encodeLabel()` actually emits for `protocol === '550'`:

```
ESC s <jobID>            ✓
ESC @                    ← buildReset() — see §1.1
ESC D <bytesPerRow>      ← buildSetBytesPerLine() — see §1.2
ESC <density-letter>     ← buildDensity() — see §1.3
ESC h | ESC i            ✓
ESC L <dots:u16>         ← see §3
[ESC q <roll>]           ← see §1.4
<raster row bytes>       ← buildRasterRow with 0x16/0x17 prefixes — see §1.5
ESC E                    ← per-copy, instead of ESC G between + ESC E at end — see §1.6
                         ← no ESC n, no ESC D header, no ESC Q
```

### 1.1 [blocker] `buildReset()` emits `ESC @`, which on the 550 reboots the print engine

`protocol.ts:4` returns `1B 40`. The 550 spec defines `ESC @` (`1B 40`) as
**"Restart Print Engine — Reboots the print engine"**. The 450 used `ESC @` as
a soft reset; on the 550 it is destructive and must not appear inside a job.

### 1.2 [blocker] `buildSetBytesPerLine` collides with `ESC D` Start of Label Print Data

`protocol.ts:8` emits `1B 44 <n>` (`ESC D <byte>`). On the 450, that was
"Set bytes per line". On the 550, `ESC D` is the **mandatory** Start-of-Label
header with format `ESC D <bpp:u8> <align:u8> <width:u32> <height:u32>` —
14 header bytes followed by the raster payload. We are sending a 3-byte
truncation of that command, which the 550 firmware will read as an `ESC D`
with bpp = `<n>` and then consume the next 13 bytes (currently `ESC C ...`,
`ESC h ...`, etc.) as alignment / width / height before treating the rest as
print data.

This single mismatch corrupts the entire job stream from the 550's point of
view; nothing past `buildSetBytesPerLine()` will be parsed correctly.

### 1.3 [bug] `buildDensity()` emits 450-style density letters, not `ESC C`

`protocol.ts:16` emits `1B 63|64|65|67` for light/medium/normal/high. On the 550:

- `ESC C` (`1B 43`) is **Set Print Density** with format `ESC C <duty:u8>`,
  duty in percent, default 100, range 0..200.
- `ESC e` (`1B 65`) — what we emit for `density='normal'` — is
  **Reset Print Density to Default** (no parameter). So "normal" happens to
  be a no-op that resets to 100 %, but the other three are unrecognised on
  the 550.

Need an explicit `ESC C <duty>` mapping (e.g. light≈70, medium≈85, normal=100,
high≈130). Verify exact percentages against Dymo's macOS CUPS driver if we
can capture it.

### 1.4 [bug] `ESC q` is "Select Output Tray", not "Select Roll"

`buildSelectRoll(roll)` emits `1B 71 <roll>`. The spec marks `ESC q` (Set
Output Tray) as **"will be supported by LW550 Twin Turbo"**. There is no
twin-roll model in the 550 lineup today, so emitting this on a vanilla 550 /
550 Turbo / 5XL is undefined. The whole `roll` option is 450-Twin-Turbo /
450-Duo specific and should be a no-op on the 550 protocol path.

### 1.5 [blocker] Raster rows are wrapped in `0x16` / `0x17`, which the 550 does not use

`buildRasterRow()` prefixes each row with `0x16` (literal) or `0x17` (RLE).
The 550 spec describes raster as a contiguous payload that follows the `ESC D`
header — there is no per-row escape, no `0x16`/`0x17` framing, no RLE.
Emitting these bytes inline corrupts the data stream.

### 1.6 [bug] Wrong feed command between labels and missing job trailer

For each copy we emit `ESC E` (form feed to tear bar). Per spec:

- Between labels in a multi-label job: `ESC G` (Short Form Feed) — "feeds the
  next label into print position … optimizes the printer and minimizes print
  time by eliminating the need to reverse feed".
- For the last label: `ESC E` (Form Feed to Tear Position).

Using `ESC E` between every copy forces a reverse-feed on every subsequent
label, which the spec explicitly calls out as the inefficient path. Also
missing entirely:

- `ESC n <index:u32>` per label — **mandatory**.
- `ESC D <bpp> <align> <width> <height>` header per label — **mandatory**.
- `ESC Q` to close the job — **mandatory**. Without it the printer will not
  release the host lock and subsequent jobs will be rejected.

---

## 2. Status (`status.ts`, `parseStatus550`)

### 2.1 [blocker] 32-byte response layout is wrong

The current parser reads byte 0 as a flag bitmap, bytes 1–2 as error masks,
and bytes 4–7 as media width/length in mm. None of that matches the spec.

Actual layout from the spec table (§"Print Status Response"):

| Byte    | Field             | Type | Notes                                   |
|---------|-------------------|------|-----------------------------------------|
| 0       | Print status      | enum | 0=idle, 1=printing, 2=error, 3=cancel, 4=busy, 5=unlock |
| 1–4     | Print job ID      | u32  | echoes the `ESC s` job ID               |
| 5–6     | Label index       | u16  | echoes `ESC n`                          |
| 7       | Reserved          |      | default 0                               |
| 8       | Print head status | enum | 0=ok, 1=overheated, 2=unknown           |
| 9       | Print density     | u8   | percent, default 100                    |
| 10      | Main bay status   | enum | 0..10 (see §2.2)                        |
| 11–22   | SKU info          | char | 12-byte SKU string                      |
| 23–26   | Error ID          | u32  | 0 = none                                |
| 27–28   | Label count       | u16  | remaining labels on roll                |
| 29      | EPS status        | nibble | bit0 = external power supply present  |
| 30      | Print head voltage| nibble | 0=unknown, 1=ok, 2=low, 3=critical, 4=too low |
| 31      | Reserved          |      | default 0xFF                            |

We currently treat byte 0 as a generic "non-zero ⇒ busy" flag (it is a
5-state enum, where 1=printing is normal and not an error). We extract media
width/length from bytes 4–7 — those bytes are actually part of the print
job ID and label index, so `findMediaByDimensions` is fed garbage.

### 2.2 [gap] Main bay status carries the rich media diagnostics we need

`bytes[10]` is the field that maps cleanly to our `PrinterStatus`:

```
0 = bay status unknown
1 = bay open; media presence unknown        → cover_open
2 = no media present                        → no_media
3 = media not inserted properly             → no_media / paper_jam
4 = media present – media status unknown
5 = media present – empty                   → no_media
6 = media present – critically low
7 = media present – low
8 = media present – ok                      → mediaLoaded=true, ready
9 = media present – jammed                  → paper_jam
10 = media present – counterfeit media      → (NFC-lock failure)
```

The "counterfeit media" state is the user-visible side of `nfcLock: true`
and deserves its own error code. "Low" / "critically low" should surface as
warnings (we don't have a warnings concept yet — could fold into a new
`PrinterStatus.media` field).

### 2.3 [gap] Media identity comes from SKU / `ESC U`, not from status width/length

The status response carries SKU as 12 chars (bytes 11–22). The spec also
defines a separate **`ESC U` Get SKU Information** command returning a
63-byte structure with magic, CRC, SKU number, brand, region, material type,
label type, color, marker geometry, label width/length in mm, liner width,
total label count, production date/time, etc. — the actual media descriptor
the printer reads off the NFC tag.

The right design is: parse SKU from status byte 11–22 to *identify* the roll;
issue `ESC U` (once per insert, on cover-close transitions) to get the full
descriptor; map it through the media registry. `findMediaByDimensions(w,h)`
on the status response will never work because those mm fields don't exist
there.

### 2.4 [bug] `ESC A` is missing the lock-mode parameter byte — DONE

`buildStatusRequest(device)` now returns the 3-byte form on 550
(`ESC A <lock>`); `getStatus()` uses `lock=0` (heartbeat) and
`print()` calls `acquire550Lock()` first which sends `lock=1`,
parses the 32-byte response, and refuses to proceed if (a) byte 0 ==
`PRINT_STATUS_LOCK_NOT_GRANTED` (5) → another host holds the lock,
or (b) the bay/head/voltage status reports an error condition. The
job trailer `ESC Q` releases the lock automatically per spec p.13.

Lock acquisition runs unconditionally on 550 devices regardless of
transport — on USB it's effectively a free pre-flight status check
(no other host can race), on TCP it's the load-bearing arbitration
mechanism. Either way, the user gets early failure on jam / no
media / cover-open / counterfeit / overheated / low-voltage rather
than discovering it mid-job.

`lock=2` (between-label query) is **not** wired — would require
restructuring `encode550Label` to return per-label byte chunks so
the driver can interleave queries between writes. Marginal value;
deferred.

### 2.5 [bug] `buildErrorRecovery()` is a 450 sequence — DONE

`recover()` is now protocol-aware on both the node and web drivers.
- 450 family (`lw-330` / `lw-450`) keeps the legacy 85×ESC + ESC A
  sync-flush sequence (`buildErrorRecovery()` in `protocol.ts`).
- 550 family sends `build550Recovery()` = `ESC Q`, releasing any
  pending job state and the host print lock.

For a destructive reboot, callers can fall back to
`build550Restart()` (`ESC @`) directly via `transport.write()`.

---

## 3. `ESC L` semantics differ between 450 and 550

Spec text: *"ESC L Set Maximum Label Length — Sets the print engine mode
between normal label stock and continuous label stock. Normal label stock is
the default mode for the print engine."*

So on the 550 this looks more like a **mode selector** ("normal vs
continuous") than a length value. The PDF does not include a parameter byte
table for `ESC L`, but the description ("between normal and continuous")
strongly implies a 1-byte mode flag, not a 2-byte u16 dot count like the 450.
The "Label Length" section also clarifies that on the 550 "label length is
determined by the SKU data found on the NFC Tag" — i.e. the host doesn't
specify it.

Need to capture a real LW 550 driver trace to confirm the parameter format
before changing this. Until then, our `buildSetLabelLength(dots)` is sending
a 450-shaped command on a 550-shaped command name.

---

## 4. Missing commands — DONE

All commands have builders in `protocol-550.ts`. Wiring choices:

| Command                    | Bytes        | Status |
|----------------------------|--------------|--------|
| `ESC n` Set Label Index    | `1B 6E n0..n3` | wired into `encode550Label` per copy |
| `ESC D` (full form)        | `1B 44 ...`    | wired into `encode550Label` per copy |
| `ESC Q` End Print Job      | `1B 51`        | wired as job trailer |
| `ESC T` Content Type       | `1B 54 mode`   | wired conditionally — emitted when caller passes `options.speed` |
| `ESC e` Reset Density      | `1B 65`        | builder only — encoder always sends explicit `ESC C <duty>`, density resets at job-end automatically per spec p.4 |
| `ESC U` Get SKU Info       | `1B 55`        | wired via `printer.getMedia()` |
| `ESC V` Get Engine Version | `1B 56`        | wired via `printer.getEngineVersion()` |
| `ESC *` Factory Reset      | `1B 2A`        | builder only — destructive, intentionally not on the adapter API |
| `ESC o` Set Label Count    | `1B 6F n`      | builder only — use case from spec is unclear |
| `ESC G` Short Form Feed    | `1B 47`        | wired between copies of multi-label jobs |
| `ESC @` Restart Engine     | `1B 40`        | builder only — destructive reboot |
| `ESC Q` Recovery           | `1B 51`        | wired via `printer.recover()` (550 path) |

---

## 5. mDNS / LAN discovery

### 5.1 TCP protocol disambiguation — DONE

`openPrinter({ host })` now requires `deviceKey` and looks up the
descriptor from the registry, same pattern as the serial path. The
silent-misidentification bug (host → first TCP-capable descriptor →
`LW_WIRELESS` (lw-450) → corrupt 550 jobs) is closed. Throws with
the list of TCP-capable keys when `deviceKey` is missing or unknown,
or when the descriptor has no TCP transport.

### 5.2 mDNS hostname patterns captured (forward-looking) — DONE

The instance-name patterns from spec p.10 are recorded in JSON5
comments on `LW_550_TURBO.json5` and `LW_5XL.json5`:

```
DYMOLW550T<6-hex MAC>E
DYMOLW5XL<6-hex MAC>E
```

No code reads them today. A small contracts patch (see
`contracts/plans/backlog/mdns-hostname-pattern.md`) adds an optional
`tcp.mdns.hostnamePattern` field; once that publishes, the comments
get promoted to structured entries.

### 5.3 mDNS auto-discovery — not done

Adding `bonjour` / `mdns-js` as a dep so `listPrinters()` enumerates
networked 550s automatically. Genuinely out of scope for the
protocol-fork plan; tracked as a separate follow-up. Until then,
the explicit `openPrinter({ host, deviceKey })` path works.

---

## 6. What is correct today

For the record — these match the spec and don't need changes:

- VID `0x0922` and PIDs `0x0028` / `0x0029` / `0x002A`. ✓
- Head dot counts (672 / 672 / 1248) and bytes-per-row (84 / 84 / 156). ✓
- 300 dpi assumption. ✓
- `nfcLock: true` flag for all three 550 models. ✓
- `network: 'wired'` for 550 Turbo and 5XL, `'none'` for plain 550. ✓
- Job-header `ESC s <u32>` byte order (little-endian). ✓
- `parseStatus()` dispatch on `device.protocol` and `statusByteCount()` returning 32 for 550. ✓ (the count is right; the layout it parses isn't — see §2.1)

---

## Status of work

1. **Capture a real packet trace** — *not done; recommended before
   moving to `implemented/`.* The implementation is from-spec only;
   the two judgment calls below would resolve cleanly with a
   Wireshark / `usbmon` capture from Dymo Connect.
2. ~~**Fork the 550 encoder away from the 450.**~~ — *done.*
   `packages/core/src/protocol-550.ts` is the clean fork. The
   `encodeLabel` dispatch in `protocol.ts` routes `lw-550` engines
   straight to `encode550Label` before any 450-shaped byte gets emitted.
3. ~~**Fix the status parser first.**~~ — *done.* `parseStatus550`
   in `status.ts` now reads the spec layout (bay status, head
   voltage, SKU, error ID). 27 status tests + 10 duo-tape-status
   tests cover every documented enum value.
4. ~~**Implement the 550 job structure** end-to-end.~~ — *done.*
   `ESC s` header → mode → density → per-label `ESC n` + 12-byte
   `ESC D` header + raw raster → `ESC G` between / `ESC E` last
   → `ESC Q` trailer. 41 protocol-550 tests verify the wire bytes.
5. ~~**Add `ESC U` + `ESC V`.**~~ — *done.* `getMedia()` (ESC U
   → 63-byte SKU dump) and `getEngineVersion()` (ESC V → 34-byte
   HW/FW/PID) are on both the node and web `LabelWriterPrinter`.
   `print()` on a 550 best-effort-fetches SKU when no media was
   passed, replacing the broken `findMediaByDimensions` path.
6. ~~**Lock-aware status polling.**~~ — *done.* `lock=0` for
   heartbeats; `lock=1` (acquire) sent before every 550 print
   via `acquire550Lock()`, which also surfaces printer-side
   errors before the job is encoded. `lock=2` (between-labels)
   deferred — would require restructuring `encode550Label` to
   return per-label chunks; marginal value.
7. **mDNS discovery + protocol disambiguation on TCP** (§5) —
   *5.1 + 5.2 done.* TCP misidentification fixed by requiring
   `deviceKey`; mDNS hostname patterns captured in JSON5
   comments pending a small contracts patch. *5.3* (mDNS
   auto-discovery) deferred — needs a `bonjour`/`mdns-js` dep.

### Open judgment calls (need hardware)

- **Density mapping** — `light=70 / medium=85 / normal=100 / high=130 %`,
  documented in `density550Percent`. Reasonable spread around the
  100 % default; tune from a real 550 print sample.
- **`ESC L` parameter format** — omitted. Spec describes it as
  "between normal and continuous label stock" without showing a
  parameter table; the Label Length section also says length comes
  from the NFC tag for genuine media. Safest call until hardware
  confirms.
- **Print-status byte 0 sub-state encoding** — implementation
  reads byte 0 directly and treats `5` as "lock not granted to
  this host" (per spec p.14: *"5: Status reply before lock is
  granted to active host"*). Other values (0..4) treated as "we
  have the lock, proceed". If hardware shows a different
  encoding, `acquire550Lock()` is the only place to update.
