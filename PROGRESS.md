# labelwriter — Implementation Progress

> **Rules for this implementation:**
> - Complete steps in order — do not start a later step until the current one is gated and committed
> - Every step ends with a gate (typecheck + lint + test + build, or equivalent) that must pass before committing
> - Each completed step gets its own git commit
> - Do not mark a checkbox done until the gate for that step passes

---

## Step 1 — Scaffold

> plan: L1242–L1249

- [x] `LICENSE` — MIT, copyright Mannes Brak (plan: L248, L305)
- [x] `.github/FUNDING.yml` (plan: L243–L249)
- [x] `.github/ISSUE_TEMPLATE/hardware_verification.md` (plan: L1243)
- [x] Root `package.json` (plan: L253–L287)
- [x] `eslint.config.js` (plan: L290–L292)
- [x] `tsconfig.base.json` (plan: L296–L308)
- [x] `pnpm-workspace.yaml` (plan: L1244)
- [x] `.gitignore` (plan: L1244)
- [x] `.changeset/` directory (plan: L1245, L270–L272)
- [x] `.github/workflows/ci.yml` (plan: L995–L1044)
- [x] `.github/workflows/release.yml` (plan: L1048–L1108)
- [x] `.github/workflows/docs.yml` (plan: L1112–L1165)
- [x] `HARDWARE.md` — device table, NFC lock section, protocol generation section (plan: L1246, L43–L47)
- [x] Root `README.md` (plan: L1170–L1234)
- [x] This `PROGRESS.md` file
- [x] **Gate:** `pnpm install` completes without errors (plan: L1249)
- [x] **Commit:** `chore: scaffold monorepo`

---

## Step 2 — `@thermal-label/labelwriter-core`

> plan: L1251–L1257, L405–L612

- [ ] `packages/core/package.json` (plan: L413–L436)
- [ ] `packages/core/README.md` (plan: L368–L373)
- [ ] `packages/core/tsconfig.json`
- [ ] `packages/core/src/types.ts` — `DeviceDescriptor`, `NetworkSupport`, `PrintOptions`, `Density` (plan: L456–L477)
- [ ] `packages/core/src/devices.ts` — full `DEVICES` registry + `findDevice` (plan: L483–L551)
- [ ] `packages/core/src/protocol.ts` — all encoder functions, 450 and 550 protocol (plan: L554–L588)
  - [ ] `buildReset()` (plan: L557)
  - [ ] `buildSetBytesPerLine(n)` (plan: L558)
  - [ ] `buildSetLabelLength(dots)` — little-endian 16-bit (plan: L559)
  - [ ] `buildDensity(density)` (plan: L560)
  - [ ] `buildMode(mode)` (plan: L561)
  - [ ] `buildFormFeed()` (plan: L562)
  - [ ] `buildShortFormFeed()` (plan: L563)
  - [ ] `buildSelectRoll(roll)` (plan: L564)
  - [ ] `buildJobHeader(jobId)` — 550 only (plan: L565)
  - [ ] `buildStatusRequest()` (plan: L566)
  - [ ] `buildErrorRecovery()` — 85 × ESC + ESC A (plan: L567, L69–L71)
  - [ ] `buildRasterRow(rowBytes, compress?)` — uncompressed `0x16` and RLE `0x17` (plan: L568–L569, L96–L102)
  - [ ] `encodeLabel(device, bitmap, options)` — full label stream (plan: L570–L588)
    - [ ] Fit bitmap to head width (`padBitmap`/`scaleBitmap`) before rotation (plan: L574)
    - [ ] `rotateBitmap(bitmap, 90)` after fitting (plan: L574–L575)
    - [ ] Prepend `buildJobHeader()` for 550 protocol devices (plan: L577–L579)
    - [ ] Auto-generate `jobId` from `Date.now() & 0xFFFFFFFF` if not provided (plan: L578)
    - [ ] Handle `copies > 1` by repeating raster rows + form feed, not the reset (plan: L580–L581)
- [ ] `packages/core/src/index.ts` — public API re-exports (plan: L442–L477)
- [ ] `packages/core/src/__tests__/protocol.test.ts` (plan: L593–L606)
  - [ ] Reset produces `[0x1B, 0x40]`
  - [ ] Set bytes per line encodes correct byte value
  - [ ] Set label length — little-endian, e.g. 200 dots → `[0x1B, 0x4C, 0xC8, 0x00]`
  - [ ] Form feed produces `[0x1B, 0x45]`
  - [ ] Job header: first byte `0x1B`, second `0x73`, then 4 ID bytes
  - [ ] Raster row uncompressed: first byte `0x16`, length = 1 + bytesPerRow
  - [ ] Raster row compressed: first byte `0x17`, correct RLE encoding
  - [ ] Error recovery: exactly 85 `0x1B` bytes followed by `[0x1B, 0x41]`
  - [ ] `encodeLabel` 450 device: no job header, starts with reset
  - [ ] `encodeLabel` 550 device: starts with job header before reset
  - [ ] `encodeLabel` correct row count matches bitmap width after rotation
  - [ ] `encodeLabel` copies=2: two sets of raster rows + form feeds
  - [ ] `encodeLabel` Twin Turbo: roll select command present when `roll` option given
- [ ] `packages/core/src/__tests__/devices.test.ts` (plan: L607–L612)
  - [ ] `findDevice` resolves all known PIDs
  - [ ] `findDevice` returns `undefined` for unknown PID
  - [ ] All 450 protocol devices have `nfcLock: false`
  - [ ] All 550 protocol devices have `nfcLock: true`
  - [ ] `LW_5XL` has `bytesPerRow: 156`, all others `84`
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-core typecheck` (plan: L1256)
- [ ] **Gate:** `pnpm lint` (plan: L1256)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-core test` (plan: L1256)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-core build` (plan: L1256)
- [ ] **Commit:** `feat: add labelwriter-core`

---

## Step 3 — `@thermal-label/labelwriter-node`

> plan: L1259–L1265, L615–L751

- [ ] `packages/node/package.json` (plan: L621–L645)
- [ ] `packages/node/README.md` (plan: L375–L384)
- [ ] `packages/node/tsconfig.json`
- [ ] `packages/node/src/transport.ts` — `Transport` interface, `UsbTransport`, `TcpTransport` (plan: L650–L671)
  - [ ] `Transport` interface: `write`, `read`, `close` (plan: L650–L654)
  - [ ] `UsbTransport.open(vid, pid)` — real `usb` types, no wrappers (plan: L655–L659, L666–L672)
  - [ ] `UsbTransport.write()` → Bulk OUT endpoint (plan: L667)
  - [ ] `UsbTransport.read()` → Bulk IN, convert `Buffer` with `new Uint8Array(buffer)` (plan: L668–L669)
  - [ ] `UsbTransport.close()` — async, always await in `finally` (plan: L670–L671)
  - [ ] `TcpTransport.connect(host, port?)` — defaults to port 9100 (plan: L661, L673–L676)
  - [ ] `TcpTransport` partial read handling — accumulate until `byteCount` received (plan: L675)
- [ ] `packages/node/src/printer.ts` — `LabelWriterPrinter` class (plan: L683–L728)
  - [ ] `getStatus()` — read 1 byte (450) or 32 bytes (550) based on `device.protocol` (plan: L733)
  - [ ] `print(bitmap, options)` (plan: L689)
  - [ ] `printText(text, options)` — render via `renderText`, fit, rotate, encode, write (plan: L689, L737–L738)
  - [ ] `printImage(image, options)` — optional `@napi-rs/canvas` (plan: L690)
  - [ ] `recover()` — sends `buildErrorRecovery()`, reads status (plan: L691, L734–L735)
  - [ ] `close()` — always async, always in `finally` (plan: L692, L741)
- [ ] `packages/node/src/discovery.ts` — `listPrinters()`, filters by known VID/PID (plan: L683)
- [ ] `packages/node/src/index.ts` — public API exports (plan: L683–L729)
- [ ] `packages/node/src/__tests__/usb-transport.test.ts` — mock `usb`; write to bulk endpoint; Buffer→Uint8Array (plan: L745–L747)
- [ ] `packages/node/src/__tests__/tcp-transport.test.ts` — mock `net`; handle partial reads (plan: L748)
- [ ] `packages/node/src/__tests__/printer.test.ts` — correct byte sequences for 450 and 550; status 1 vs 32 bytes; `recover()` (plan: L749)
- [ ] `packages/node/src/__tests__/discovery.test.ts` — `listPrinters()` filters by known VID/PID (plan: L750)
- [ ] `packages/node/src/__tests__/integration/` — hardware-gated stubs behind `LABELWRITER_INTEGRATION=1` (plan: L751, L38–L40)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-node typecheck` (plan: L1264)
- [ ] **Gate:** `pnpm lint` (plan: L1264)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-node test` (plan: L1264)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-node build` (plan: L1264)
- [ ] **Commit:** `feat: add labelwriter-node`

---

## Step 4 — `@thermal-label/labelwriter-cli`

> plan: L1267–L1269, L755–L830

- [ ] `packages/cli/package.json` (plan: L765–L782)
- [ ] `packages/cli/README.md` (plan: L392–L396)
- [ ] `packages/cli/tsconfig.json`
- [ ] `packages/cli/bin/labelwriter.js` — dynamic import shim (plan: L823–L825)
- [ ] `packages/cli/src/index.ts` — `run()` entry point
- [ ] `packages/cli/src/commands/list.ts` — `labelwriter list` (plan: L787)
- [ ] `packages/cli/src/commands/status.ts` — `labelwriter status [--host]` (plan: L788)
- [ ] `packages/cli/src/commands/print-text.ts` — `labelwriter print text <text>` with all options (plan: L789, L796–L806)
- [ ] `packages/cli/src/commands/print-image.ts` — `labelwriter print image <file>` with all options (plan: L790, L808–L819)
- [ ] `packages/cli/src/commands/recover.ts` — `labelwriter recover` (plan: L791)
- [ ] `packages/cli/src/__tests__/` — mock `@thermal-label/labelwriter-node`; test each command (plan: L830)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-cli typecheck` (plan: L1269)
- [ ] **Gate:** `pnpm lint` (plan: L1269)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-cli test` (plan: L1269)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-cli build` (plan: L1269)
- [ ] **Commit:** `feat: add labelwriter-cli`

---

## Step 5 — `@thermal-label/labelwriter-web`

> plan: L1271–L1273, L833–L896

- [ ] `packages/web/package.json` (plan: L840–L861)
- [ ] `packages/web/README.md` (plan: L385–L390)
- [ ] `packages/web/tsconfig.json` — extends `@mbtech-nl/tsconfig/browser`, no `@types/node` (plan: L860, L891)
- [ ] `packages/web/src/transport.ts` — WebUSB `transferOut`/`transferIn` (plan: L886–L890)
- [ ] `packages/web/src/printer.ts` — `WebLabelWriterPrinter` class (plan: L870–L882)
  - [ ] `requestPrinter()` — `navigator.usb.requestDevice` with all known PIDs (plan: L887)
  - [ ] `fromUSBDevice(device)` (plan: L868)
  - [ ] `getStatus()` — 1 byte (450) or 32 bytes (550) via `transferIn` (plan: L889)
  - [ ] `print`, `printText`, `printImage`, `printImageURL` (plan: L873–L878)
  - [ ] `recover()` (plan: L879)
  - [ ] `isConnected()`, `disconnect()` (plan: L880–L881)
- [ ] `packages/web/src/index.ts` — public API exports (plan: L867–L882)
- [ ] `packages/web/src/__tests__/` — Vitest + jsdom, fake `USBDevice` with transfer spies (plan: L893–L896)
  - [ ] Correct byte streams for 450 and 550 protocol devices
  - [ ] Status parsed correctly per protocol generation
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-web typecheck` (plan: L1273)
- [ ] **Gate:** `pnpm lint` (plan: L1273)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-web test` (plan: L1273)
- [ ] **Gate:** `pnpm --filter @thermal-label/labelwriter-web build` (plan: L1273)
- [ ] **Commit:** `feat: add labelwriter-web`

---

## Step 6 — Docs

> plan: L1275–L1283, L899–L987

- [ ] `docs/.vitepress/config.ts` (plan: L948–L987)
- [ ] `docs/.vitepress/theme/index.ts` (plan: L921)
- [ ] `docs/.vitepress/components/LiveDemo.vue` — WebUSB, text input, bitmap preview, Chrome/Edge note, NFC note (plan: L938–L942)
- [ ] `docs/index.md` — hero, features, ecosystem links, NFC callout (plan: L914, L929–L930)
- [ ] `docs/getting-started.md` — Node.js + CLI + Web quickstart, Linux udev, NFC lock subsection (plan: L915, L931–L932)
- [ ] `docs/node.md` — USB, TCP, printText, printImage, status, recover, API table (plan: L916)
- [ ] `docs/cli.md` — all commands with flag tables and examples (plan: L917)
- [ ] `docs/web.md` — browser support, install, quick start, API table, demo link (plan: L918)
- [ ] `docs/hardware.md` — device table, 450 vs 550, NFC lock detail, print head geometry (plan: L919, L933)
- [ ] `docs/core.md` — protocol reference, 450 vs 550 sequences, byte tables, RLE, error recovery; note job header does not disable NFC (plan: L920, L934)
- [ ] `docs/demo.md` — renders `<LiveDemo />` (plan: L921)
- [ ] NFC lock documented in all required places (plan: L929–L935)
  - [ ] `index.md`: callout card
  - [ ] `getting-started.md`: dedicated subsection
  - [ ] `hardware.md`: NFC column + explanation
  - [ ] `core.md`: note that job header does not disable NFC checking
- [ ] **Gate:** `pnpm docs:api` — typedoc generates without errors (plan: L269, L1282)
- [ ] **Gate:** `pnpm docs:build` — VitePress build completes without errors (plan: L1283)
- [ ] **Commit:** `docs: add VitePress documentation site`

---

## Step 7 — Final

> plan: L1284–L1288

- [ ] `pnpm test:coverage` passes with 90% threshold across all packages (plan: L1285, L400–L402)
- [ ] All checkboxes in this file are ticked (plan: L1286)
- [ ] `ci.yml` passes locally (plan: L1287)
- [ ] **Commit:** `chore: verified all gates pass, ready for release`
