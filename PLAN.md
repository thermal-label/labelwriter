# labelwriter — Implementation Plan

> Agent implementation plan for a TypeScript monorepo providing a clean,
> cross-platform driver for Dymo LabelWriter label printers. Supports USB
> (Printer Class bulk transfer) and TCP network transport (550 Turbo and 5XL).
>
> Two protocol generations are covered:
> - **LabelWriter 450 series** — ESC/raster, officially documented, no NFC lock
> - **LabelWriter 550 series + 5XL** — ESC/raster with job header, NFC label lock
>
> The 550 series NFC lock means printing only works with genuine Dymo labels.
> This is a hardware enforcement — the driver cannot bypass it. Document clearly.
>
> **Lessons learned from labelmanager and brother-ql apply here in full.**
> See section 13 — Key Constraints & Agent Notes.

---

## 1. Supported Devices & Hardware Compatibility

All devices share Vendor ID `0x0922` (Dymo-CoStar Corp.) and use USB Printer
Class (bulk transfer). The byte stream is identical over USB and TCP.

| Device | USB PID | Head dots | Network | NFC lock | Status | Notes |
|---|---|---|---|---|---|---|
| LabelWriter 400 | `0x0021` | 672 | ❌ | ❌ | 🟡 Expected | Predecessor to 450 series, same protocol |
| LabelWriter 400 Turbo | `0x0023` | 672 | ❌ | ❌ | 🟡 Expected | Same protocol as 450 |
| LabelWriter 450 | `0x0029` | 672 | ❌ | ❌ | 🟡 Expected | Reference 450 protocol |
| LabelWriter 450 Turbo | `0x002A` | 672 | ❌ | ❌ | 🟡 Expected | |
| LabelWriter 450 Twin Turbo | `0x002B` | 672 | ❌ | ❌ | 🟡 Expected | Dual roll — `ESC q` roll select |
| LabelWriter 450 Duo | `0x002C` | 672 | ❌ | ❌ | 🟡 Expected | Also has D1 tape head (128 dots, 180 dpi) — tape out of scope |
| LabelWriter 4XL | `0x0025` | 672 | ❌ | ❌ | 🟡 Expected | Wide format labels |
| LabelWriter Wireless | `0x0031` | 672 | WiFi | ❌ | 🟡 Expected | TCP supported |
| LabelWriter 550 | `0x0052` | 672 | ❌ | ✅ | 🟡 Expected | NFC lock — genuine labels only |
| LabelWriter 550 Turbo | `0x0053` | 672 | LAN | ✅ | 🟡 Expected | NFC lock + TCP |
| LabelWriter 5XL | `0x0054` | 1248 | LAN | ✅ | 🟡 Expected | Wide head (101mm) + NFC lock + TCP |

> Have a device marked 🟡 Expected? Run `LABELWRITER_INTEGRATION=1 pnpm test`
> and open a [hardware verification issue](/.github/ISSUE_TEMPLATE/hardware_verification.md).
> We'll mark it verified and add you to the contributors list.

**NFC label lock (550 series):** The LabelWriter 550 and 5XL only print with
authentic Dymo labels that have a valid NFC tag. This is enforced in hardware
and cannot be bypassed in software. Document this prominently — it is the most
common reason users report these printers "not working" with third-party labels.

See `HARDWARE.md` for full details.

---

## 2. Protocol Reference

> Sources:
> - *LabelWriter 450 Series Printers Technical Reference Manual* (Sanford L.P., official)
> - *LabelWriter 550 Series Printers Technical Reference Manual* (Dymo, official)
> Both are publicly available from Dymo's developer resources.

### 2.1 Transport

**USB:** Standard USB 2.0 Printer Class. Data sent to the Bulk OUT endpoint.
No mode-switching required — unlike the LabelManager, LabelWriter printers
enumerate directly as printer class devices.

**TCP:** Raw TCP socket to port 9100. The byte stream is **byte-for-byte
identical** to the USB stream. Supported on LabelWriter Wireless, 550 Turbo,
and 5XL. Used for WiFi and wired LAN connectivity.

**Error recovery (USB/TCP):** To reset from an unknown or error state, send
at least **85 consecutive `ESC` (0x1B) bytes** followed by `ESC A` (status
request). This flushes any partial raster line buffer (max 84 bytes) and
forces command mode.

### 2.2 Print Head Geometry

| Model family | Head dots | Bytes per raster row | Paper path |
|---|---|---|---|
| 450 series, Wireless, 550, 550 Turbo | 672 | 84 | 63mm |
| 5XL | 1248 | 156 | ~110mm |

A `1` bit = black dot (printed). A `0` bit = white dot (unprinted).
MSB = leftmost dot on the label. No fonts — host renders everything.

### 2.3 Protocol Generations

#### 450 Series Protocol

Data commands consist of raster rows and ESC commands. No job header required.

**Raster row (uncompressed):**
```
0x16 [n bytes of pixel data]
```
Where n is set by `ESC D` (default 84 for 450 series, 156 for 4XL).

**Raster row (compressed — run-length encoding):**
```
0x17 [compressed bytes]
```
Bit 7 of each compressed byte = pixel value (0=white, 1=black).
Bits 6-0 = repeat count minus 1 (0 = 1 repetition, 127 = 128 repetitions).
Compression is optional — uncompressed is always safe.

**Typical 450 print sequence:**
```
1B 40               ESC @ — software reset
1B 68               ESC h — text speed mode (300×300 dpi)
                    or 1B 69 for graphics mode (300×600 dpi)
1B 4C n1 n2         ESC L — set label length in dots (little-endian 16-bit)
[for each raster row:]
  16 [84 bytes]     SYN + pixel data (uncompressed)
1B 45               ESC E — form feed (advance to tear bar)
```

#### 550 Series Protocol

The 550 series adds a mandatory **job header** (`ESC s`) and a **label header**
(`ESC L` + additional fields). The core raster data format is identical to 450.

**Job header (mandatory for 550, absent in 450):**
```
1B 73 [n1] [n2] [n3] [n4]    ESC s — print job start
```
n1–n4 = 4-byte unique job ID (any value, e.g. incrementing counter).

**550 print sequence:**
```
1B 73 n1 n2 n3 n4   ESC s — job start with unique job ID
1B 68               ESC h — text mode (or 1B 69 for graphics)
1B 4C n1 n2         ESC L — label length in dots
[for each raster row:]
  16 [84 bytes]     SYN + pixel data
1B 45               ESC E — form feed
```

**5XL differences:** bytes per row = 156 (1248 dots). Otherwise identical
to 550 protocol including job header requirement.

### 2.4 Complete ESC Command Set

All commands supported across the 450 and 550 series:

| Command | Bytes | Description |
|---|---|---|
| Software Reset | `1B 40` | Reset all parameters to power-on defaults |
| Get Status | `1B 41` | Request 1-byte status response (see 2.6) |
| Set Dot Tab | `1B 42 n` | Left margin offset in bytes (0–83 for 450) |
| Set Print Temp Low | `1B 63` | Light print density |
| Set Bytes per Line | `1B 44 n` | Bytes per raster row (default 84 / 156) |
| Set Print Temp Med | `1B 64` | Medium print density |
| Form Feed | `1B 45` | Advance to tear bar position |
| Skip N Lines | `1B 46 01 n` | Feed n blank lines |
| Short Form Feed | `1B 47` | Feed to print head position (no reverse on next label) |
| Set Print Temp Normal | `1B 65` | Normal print density (default) |
| Set Print Temp High | `1B 67` | Dark print density |
| Text Speed Mode | `1B 68` | 300×300 dpi — for text labels |
| Graphics Mode | `1B 69` | 300×600 dpi — for images/barcodes |
| Set Label Length | `1B 4C n1 n2` | Label height in dots, little-endian 16-bit |
| Set Continuous Mode | `1B 4C FF FF` | Continuous feed mode (negative value) |
| Select Roll | `1B 71 n` | Twin Turbo only: `n=0` left roll, `n=1` right roll |
| Return Revision | `1B 56` | Firmware version string response |
| Print Job Start | `1B 73 n1 n2 n3 n4` | **550 series only** — mandatory job header |
| Restore Defaults | `1B 2A` | Restore factory defaults |
| SYN raster row | `16 [n bytes]` | Uncompressed raster line |
| ETB raster row | `17 [bytes]` | Compressed raster line (RLE) |

### 2.5 Status Response (1 byte — 450 series)

Sent by printer in response to `ESC A` (`1B 41`).

| Bit | Meaning |
|---|---|
| 0 | Paper out |
| 1 | Pause |
| 2 | Label too long |
| 3–7 | Reserved |

`0x00` = ready, no errors.

### 2.6 Status Response (32 bytes — 550 series)

The 550 series returns a 32-byte status packet.

| Offset | Meaning |
|---|---|
| 0 | Status flags |
| 1 | Error flags 1 |
| 2 | Error flags 2 |
| 3 | Label type |
| 4–5 | Label width (dots) |
| 6–7 | Label length (dots) |
| 8–31 | Reserved |

### 2.7 Error Recovery

To recover from an unknown state or synchronisation error:
```
85 × 0x1B   (85 ESC bytes — exceeds max raster line of 84 bytes)
1B 41       ESC A — status request
```
Wait for status response before sending further commands.

---

## 3. Repository Structure

```
labelwriter/
├── .github/
│   ├── FUNDING.yml
│   ├── ISSUE_TEMPLATE/
│   │   └── hardware_verification.md
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── docs.yml
├── packages/
│   ├── core/                   # @thermal-label/labelwriter-core
│   ├── node/                   # @thermal-label/labelwriter-node
│   ├── cli/                    # @thermal-label/labelwriter-cli
│   └── web/                    # @thermal-label/labelwriter-web
├── docs/
├── LICENSE
├── HARDWARE.md
├── eslint.config.js
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

---

## 4. Tooling & Configuration

### 4.1 Runtime & Package Manager

- **Node.js**: `>=24.0.0`
- **Package manager**: `pnpm >=9.0.0`
- **TypeScript**: `~5.5.0`

### 4.2 `LICENSE`

MIT license, copyright Mannes Brak, current year.

### 4.3 `.github/FUNDING.yml`

```yaml
github: mannes
ko_fi: mannes
```

### 4.4 Root `package.json`

```json
{
  "name": "labelwriter",
  "private": true,
  "engines": { "node": ">=24.0.0", "pnpm": ">=9.0.0" },
  "prettier": "@mbtech-nl/prettier-config",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "test:coverage": "pnpm -r run test:coverage",
    "lint": "eslint packages",
    "format": "prettier --write packages docs",
    "typecheck": "pnpm -r run typecheck",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:api": "typedoc --plugin typedoc-plugin-markdown --out docs/api packages/*/src/index.ts",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.0.0",
    "@mbtech-nl/eslint-config": "^1.0.0",
    "@mbtech-nl/prettier-config": "^1.0.0",
    "@mbtech-nl/tsconfig": "^1.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "typedoc": "^0.26.0",
    "typedoc-plugin-markdown": "^4.0.0",
    "typescript": "~5.5.0",
    "vitepress": "^1.0.0",
    "vitest": "^2.0.0"
  }
}
```

### 4.5 `eslint.config.js`

```js
import mbtech from '@mbtech-nl/eslint-config';
export default [...mbtech];
```

### 4.6 `tsconfig.base.json`

```json
{
  "extends": "@mbtech-nl/tsconfig/node",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 4.7 Per-Package `package.json` Common Fields

```json
{
  "version": "0.0.0",
  "type": "module",
  "author": "Mannes Brak",
  "license": "MIT",
  "homepage": "https://thermal-label.github.io/labelwriter/",
  "repository": {
    "type": "git",
    "url": "https://github.com/thermal-label/labelwriter.git",
    "directory": "packages/<package-name>"
  },
  "bugs": {
    "url": "https://github.com/thermal-label/labelwriter/issues"
  },
  "funding": [
    { "type": "github", "url": "https://github.com/sponsors/mannes" },
    { "type": "ko-fi",  "url": "https://ko-fi.com/mannes" }
  ],
  "files": ["dist", "README.md"],
  "engines": { "node": ">=24.0.0" },
  "publishConfig": { "access": "public" },
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

Notes:
- `core` package sets `"types": "./src/index.ts"` so workspace consumers get
  types without a build step.
- `cli` package adds `"bin": { "labelwriter": "./bin/labelwriter.js" }` and
  adds `"bin"` to `files`.

### 4.9 Per-Package README Requirements

Every package must ship a complete, publish-ready `README.md`. An agent must
not consider a package done until its README covers all of the following:

**All packages:**
- Package name as `h1` heading
- One-line description matching the `package.json` description field
- npm install snippet (`pnpm add <package-name>`)
- Requirements section (Node.js >=24, browser support where applicable)
- Links to the full docs site and GitHub repo
- License badge and MIT license statement

**`@thermal-label/labelwriter-core`:**
- Note that consumers rarely import core directly — use node or web package
- Key exports listed: `encodeLabel`, `buildErrorRecovery`, `DEVICES`, `findDevice`,
  re-exported bitmap helpers
- `DeviceDescriptor` and `PrintOptions` type shapes shown
- Protocol generation note (450 vs 550, auto-detected from device)

**`@thermal-label/labelwriter-node`:**
- Quick start: `openPrinter()` + `printText()` + `close()` in 5 lines
- Discovery: `listPrinters()` example
- TCP/network: `openPrinterTcp()` example
- Image printing: `printImage()` example
- Error recovery: `recover()` mention
- Linux udev rule requirement (raw USB access without sudo)
- NFC lock callout for 550 series users
- Optional `@napi-rs/canvas` for image decoding

**`@thermal-label/labelwriter-web`:**
- Browser support table (Chrome/Edge ✅, Firefox/Safari ❌)
- Quick start: `requestPrinter()` + `printText()`
- NFC lock callout for 550 series users
- Secure context requirement (https or localhost)

**`@thermal-label/labelwriter-cli`:**
- Global install snippet (`npm install -g`)
- All commands listed with one-line descriptions
- One usage example per command
- NFC lock note for 550 series users

### 4.8 Testing

Vitest in all packages. `@vitest/coverage-v8` in every package's devDependencies.
Hardware tests gated behind `LABELWRITER_INTEGRATION=1`.
Coverage uploaded to Codecov. 90% threshold enforced at final step only.

---

## 5. Package: `@thermal-label/labelwriter-core`

**Path:** `packages/core/`
**Purpose:** Protocol encoding, device registry. Zero runtime dependencies
beyond `@mbtech-nl/bitmap`. No Node.js built-ins. Runs in browser and Node.js.

### 5.1 Package Setup

```json
{
  "name": "@thermal-label/labelwriter-core",
  "description": "Protocol encoding and device registry for Dymo LabelWriter printers",
  "keywords": ["dymo", "labelwriter", "label-printer", "thermal-label", "usb"],
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./src/index.ts"
    }
  },
  "dependencies": {
    "@mbtech-nl/bitmap": "^0.1.0"
  },
  "devDependencies": {
    "@mbtech-nl/tsconfig": "^1.0.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

### 5.2 Public API

```typescript
// Re-exported from @mbtech-nl/bitmap
export type { LabelBitmap, RawImageData } from '@mbtech-nl/bitmap';
export { renderText, renderImage, rotateBitmap, padBitmap, scaleBitmap } from '@mbtech-nl/bitmap';

// Device registry
export const DEVICES: Record<string, DeviceDescriptor>;
export function findDevice(vid: number, pid: number): DeviceDescriptor | undefined;

// Protocol encoding
export function encodeLabel(device: DeviceDescriptor, bitmap: LabelBitmap, options?: PrintOptions): Uint8Array;
// Returns complete byte stream for one label (including reset, raster rows, form feed)

export function buildErrorRecovery(): Uint8Array;
// Returns 85 × ESC followed by ESC A — use to recover from unknown state

// Types
export interface DeviceDescriptor {
  name: string;
  vid: number;
  pid: number;
  headDots: number;         // 672 or 1248
  bytesPerRow: number;      // headDots / 8 = 84 or 156
  protocol: '450' | '550';  // determines whether job header is required
  network: NetworkSupport;
  nfcLock: boolean;         // 550 series — genuine labels only
}

export type NetworkSupport = 'none' | 'wifi' | 'wired';

export interface PrintOptions {
  density?: 'light' | 'medium' | 'normal' | 'high';
  mode?: 'text' | 'graphics';  // text = 300×300dpi, graphics = 300×600dpi
  compress?: boolean;           // RLE compression, default false
  copies?: number;
  roll?: 0 | 1;                 // Twin Turbo only
  jobId?: number;               // 550 protocol: 4-byte job ID, auto-generated if omitted
}
```

### 5.3 Device Registry (`src/devices.ts`)

```typescript
export const DEVICES = {
  LW_400: {
    name: 'LabelWriter 400',
    vid: 0x0922, pid: 0x0021,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_400_TURBO: {
    name: 'LabelWriter 400 Turbo',
    vid: 0x0922, pid: 0x0023,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_450: {
    name: 'LabelWriter 450',
    vid: 0x0922, pid: 0x0029,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_450_TURBO: {
    name: 'LabelWriter 450 Turbo',
    vid: 0x0922, pid: 0x002A,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_450_TWIN_TURBO: {
    name: 'LabelWriter 450 Twin Turbo',
    vid: 0x0922, pid: 0x002B,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_450_DUO: {
    name: 'LabelWriter 450 Duo',
    vid: 0x0922, pid: 0x002C,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_4XL: {
    name: 'LabelWriter 4XL',
    vid: 0x0922, pid: 0x0025,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'none', nfcLock: false,
  },
  LW_WIRELESS: {
    name: 'LabelWriter Wireless',
    vid: 0x0922, pid: 0x0031,
    headDots: 672, bytesPerRow: 84,
    protocol: '450', network: 'wifi', nfcLock: false,
  },
  LW_550: {
    name: 'LabelWriter 550',
    vid: 0x0922, pid: 0x0052,
    headDots: 672, bytesPerRow: 84,
    protocol: '550', network: 'none', nfcLock: true,
  },
  LW_550_TURBO: {
    name: 'LabelWriter 550 Turbo',
    vid: 0x0922, pid: 0x0053,
    headDots: 672, bytesPerRow: 84,
    protocol: '550', network: 'wired', nfcLock: true,
  },
  LW_5XL: {
    name: 'LabelWriter 5XL',
    vid: 0x0922, pid: 0x0054,
    headDots: 1248, bytesPerRow: 156,
    protocol: '550', network: 'wired', nfcLock: true,
  },
} as const satisfies Record<string, DeviceDescriptor>;
```

### 5.4 Protocol Encoder (`src/protocol.ts`)

Implement these functions:

- `buildReset(): Uint8Array` — `1B 40`
- `buildSetBytesPerLine(n: number): Uint8Array` — `1B 44 n`
- `buildSetLabelLength(dots: number): Uint8Array` — `1B 4C n1 n2` little-endian
- `buildDensity(density: Density): Uint8Array` — `1B 63/64/65/67`
- `buildMode(mode: 'text' | 'graphics'): Uint8Array` — `1B 68` or `1B 69`
- `buildFormFeed(): Uint8Array` — `1B 45`
- `buildShortFormFeed(): Uint8Array` — `1B 47`
- `buildSelectRoll(roll: 0 | 1): Uint8Array` — `1B 71 n`
- `buildJobHeader(jobId: number): Uint8Array` — `1B 73 n1 n2 n3 n4` (550 only)
- `buildStatusRequest(): Uint8Array` — `1B 41`
- `buildErrorRecovery(): Uint8Array` — 85 × `1B` then `1B 41`
- `buildRasterRow(rowBytes: Uint8Array, compress?: boolean): Uint8Array`
  — uncompressed: `16 [bytes]`, compressed: `17 [rle bytes]`
- `encodeLabel(device, bitmap, options): Uint8Array` — full label stream

**Key notes for `encodeLabel`:**
- Fit bitmap height to `bytesPerRow * 8` BEFORE rotating — use `padBitmap`
  or `scaleBitmap` from `@mbtech-nl/bitmap` first, then `rotateBitmap(bitmap, 90)`
- After rotation, `widthPx` = head dots (672 or 1248), `heightPx` = label length
- Each rotated row maps to one raster row write
- For 550 protocol devices: prepend `buildJobHeader()` — auto-generate a jobId
  from `Date.now() & 0xFFFFFFFF` if not provided in options
- Handle `copies > 1` by repeating the raster rows + form feed, NOT by
  repeating the full reset sequence

**RLE compression algorithm:**
```
For each run of identical pixels:
  compressedByte = (pixelValue << 7) | (runLength - 1)
  where pixelValue = 1 for black, 0 for white
  and runLength max = 128
```

### 5.5 Tests (`src/__tests__/`)

- `protocol.test.ts`
  - Reset: `[0x1B, 0x40]`
  - Set bytes per line: correct byte value
  - Set label length: correct little-endian encoding, e.g. 200 dots = `[0x1B, 0x4C, 0xC8, 0x00]`
  - Form feed: `[0x1B, 0x45]`
  - Job header: first byte `0x1B`, second `0x73`, then 4 ID bytes
  - Raster row uncompressed: first byte `0x16`, length = 1 + bytesPerRow
  - Raster row compressed: first byte `0x17`, correct RLE encoding
  - Error recovery: exactly 85 `0x1B` bytes followed by `[0x1B, 0x41]`
  - `encodeLabel` 450 device: no job header, starts with reset
  - `encodeLabel` 550 device: starts with job header before reset
  - `encodeLabel` correct row count matches bitmap width after rotation
  - `encodeLabel` copies=2: two sets of raster rows + form feeds
  - `encodeLabel` Twin Turbo: roll select command present when roll option given
- `devices.test.ts`
  - `findDevice` for all known PIDs
  - `findDevice` undefined for unknown PID
  - All 450 protocol devices have `nfcLock: false`
  - All 550 protocol devices have `nfcLock: true`
  - LW_5XL has `bytesPerRow: 156`, all others `84`

---

## 6. Package: `@thermal-label/labelwriter-node`

**Path:** `packages/node/`
**Purpose:** Node.js driver. USB via `usb` package (libusb) and TCP via
`net.Socket`. Wraps `@thermal-label/labelwriter-core`.

### 6.1 Package Setup

```json
{
  "name": "@thermal-label/labelwriter-node",
  "description": "Node.js USB and TCP driver for Dymo LabelWriter printers",
  "keywords": ["dymo", "labelwriter", "label-printer", "thermal-label", "usb", "tcp"],
  "dependencies": {
    "@thermal-label/labelwriter-core": "workspace:*",
    "usb": "^2.0.0"
  },
  "optionalDependencies": {
    "@napi-rs/canvas": "^0.1.0"
  },
  "devDependencies": {
    "@mbtech-nl/tsconfig": "^1.0.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Uses `usb` (libusb bulk transfer), not `node-hid` — LabelWriter is USB Printer Class.

### 6.2 Transport Interface

```typescript
export interface Transport {
  write(data: Uint8Array): Promise<void>;
  read(byteCount: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

export class UsbTransport implements Transport {
  // Use real usb package types — no wrapper interfaces
  static async open(vid: number, pid: number): Promise<UsbTransport>;
}

export class TcpTransport implements Transport {
  static async connect(host: string, port?: number): Promise<TcpTransport>; // port defaults to 9100
}
```

**USB implementation notes:**
- Use real `usb` package types throughout — no custom wrapper interfaces
- `write()` sends to Bulk OUT endpoint
- `read()` reads from Bulk IN endpoint — returns `Uint8Array`
  (convert `Buffer` with `new Uint8Array(buffer)`)
- `close()` is async — always await, always call in `finally`

**TCP implementation notes:**
- `net.Socket` to port 9100
- Handle partial reads via stream buffer — accumulate until `byteCount` received
- 450 series: 1-byte status response; 550 series: 32-byte status response

### 6.3 Public API

```typescript
export function listPrinters(): PrinterInfo[];
export async function openPrinter(options?: OpenOptions): Promise<LabelWriterPrinter>;
export async function openPrinterTcp(host: string, port?: number): Promise<LabelWriterPrinter>;

export class LabelWriterPrinter {
  readonly device: DeviceDescriptor;
  readonly transport: 'usb' | 'tcp';

  getStatus(): Promise<PrinterStatus>;
  print(bitmap: LabelBitmap, options?: PrintOptions): Promise<void>;
  printText(text: string, options?: TextPrintOptions): Promise<void>;
  printImage(image: Buffer | string, options?: ImagePrintOptions): Promise<void>;
  recover(): Promise<void>;   // sends error recovery sequence
  close(): Promise<void>;
}

export interface OpenOptions {
  vid?: number;
  pid?: number;
  serialNumber?: string;
}

export interface PrinterInfo {
  device: DeviceDescriptor;
  serialNumber: string | undefined;
  path: string;
  transport: 'usb';
}

export interface PrinterStatus {
  ready: boolean;
  paperOut: boolean;
  errors: string[];
  rawBytes: Uint8Array;   // 1 byte for 450, 32 bytes for 550
}

export interface TextPrintOptions extends PrintOptions {
  invert?: boolean;
  scaleX?: number;
  scaleY?: number;
}

export interface ImagePrintOptions extends PrintOptions {
  threshold?: number;
  dither?: boolean;
  invert?: boolean;
  rotate?: 0 | 90 | 180 | 270;
}
```

### 6.4 Implementation Notes

- `getStatus()`: send `buildStatusRequest()`, read 1 byte (450) or 32 bytes (550)
  based on `device.protocol`
- `recover()`: send `buildErrorRecovery()`, read status response, return
- `printText()`: render via `renderText` from `@mbtech-nl/bitmap`, fit to head
  width, rotate, encode via `encodeLabel`, write to transport
- NFC lock: if `device.nfcLock` is true, add a note in the JSDoc that printing
  requires genuine Dymo labels — the driver itself does nothing different,
  the printer simply won't print with non-genuine labels
- CLI must close printer in `finally` — never leave USB interface claimed

### 6.5 Tests

- Mock `usb` and `net` with `vi.mock` — use real types, no custom interfaces
- `usb-transport.test.ts`: write to bulk endpoint, convert Buffer to Uint8Array
- `tcp-transport.test.ts`: write via socket, handle partial reads
- `printer.test.ts`: correct byte sequences for 450 and 550 protocol devices;
  status parsed correctly (1 vs 32 bytes); `recover()` sends correct sequence
- `discovery.test.ts`: `listPrinters()` filters by known VID/PID
- Integration tests (`LABELWRITER_INTEGRATION=1`): print text, print image, TCP

---

## 7. Package: `@thermal-label/labelwriter-cli`

**Path:** `packages/cli/`
**Purpose:** Thin CLI. No batching, templates, or barcode generation — those belong in `burnmark-cli`.

### 7.1 Package Setup

```json
{
  "name": "@thermal-label/labelwriter-cli",
  "description": "CLI for Dymo LabelWriter printers",
  "keywords": ["dymo", "labelwriter", "label-printer", "thermal-label", "cli"],
  "files": ["bin", "dist", "README.md"],
  "bin": { "labelwriter": "./bin/labelwriter.js" },
  "dependencies": {
    "@thermal-label/labelwriter-node": "workspace:*",
    "commander": "^12.0.0",
    "chalk": "^5.0.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "@mbtech-nl/tsconfig": "^1.0.0",
    "@types/node": "^22.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

### 7.2 Commands

```
labelwriter list
labelwriter status [--host <ip>]
labelwriter print text <text> [options]
labelwriter print image <file> [options]
labelwriter recover
```

**`print text` options:**
```
--invert
--scale-x <n>
--scale-y <n>
--density light|medium|normal|high
--mode text|graphics
--roll 0|1           (Twin Turbo only)
--copies <n>
--host <ip>          TCP transport
--serial <sn>        target by serial number
```

**`print image` options:**
```
--threshold <0-255>
--dither
--invert
--rotate <0|90|180|270>
--density light|medium|normal|high
--mode text|graphics
--copies <n>
--host <ip>
--serial <sn>
```

### 7.3 Binary

```js
#!/usr/bin/env node
import('../dist/index.js').then(m => m.run());
```

### 7.4 Tests

Mock `@thermal-label/labelwriter-node`. Test each command for correct argument passing and output.

---

## 8. Package: `@thermal-label/labelwriter-web`

**Path:** `packages/web/`
**Purpose:** Browser package using WebUSB API. ESM only. No Node.js.

### 8.1 Package Setup

```json
{
  "name": "@thermal-label/labelwriter-web",
  "description": "WebUSB browser driver for Dymo LabelWriter printers",
  "keywords": ["dymo", "labelwriter", "label-printer", "thermal-label", "webusb", "browser"],
  "dependencies": {
    "@thermal-label/labelwriter-core": "workspace:*"
  },
  "peerDependencies": {
    "typescript": ">=5.0"
  },
  "devDependencies": {
    "@mbtech-nl/tsconfig": "^1.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "jsdom": "^26.0.0",
    "typescript": "~5.5.0",
    "vitest": "^2.0.0"
  }
}
```

No `@types/node`. Extends `@mbtech-nl/tsconfig/browser` directly.

### 8.2 Public API

```typescript
export async function requestPrinter(options?: RequestOptions): Promise<WebLabelWriterPrinter>;
export function fromUSBDevice(device: USBDevice): WebLabelWriterPrinter;

export class WebLabelWriterPrinter {
  readonly device: USBDevice;
  readonly descriptor: DeviceDescriptor;

  getStatus(): Promise<PrinterStatus>;
  print(bitmap: LabelBitmap, options?: PrintOptions): Promise<void>;
  printText(text: string, options?: TextPrintOptions): Promise<void>;
  printImage(imageData: ImageData, options?: ImagePrintOptions): Promise<void>;
  printImageURL(url: string, options?: ImagePrintOptions): Promise<void>;
  recover(): Promise<void>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}
```

### 8.3 Implementation Notes

- `requestPrinter()` uses `navigator.usb.requestDevice({ filters })` with all known PIDs
- `device.transferOut(endpointNumber, data)` for writes
- `device.transferIn(endpointNumber, n)` for status reads (1 or 32 bytes by protocol)
- Extends `@mbtech-nl/tsconfig/browser` — no DOM types in `core`

### 8.4 Tests

- Vitest + jsdom, fake `USBDevice` with transfer spies
- Correct byte streams for 450 and 550 protocol devices
- Status parsed correctly per protocol generation

---

## 9. Documentation (`docs/`)

VitePress. Flat page structure.

### 9.1 Site Structure

```
docs/
├── index.md            landing page — hero, features, ecosystem links, NFC note
├── getting-started.md  quickstart Node.js + CLI + Web; Linux udev; NFC lock explanation
├── node.md             USB, TCP, printText, printImage, status, recover, API table
├── cli.md              all commands with flag tables and examples
├── web.md              browser support, install, quick start, API table, demo link
├── hardware.md         device table, 450 vs 550 protocol, NFC lock detail, print head geometry
├── core.md             protocol reference — 450 vs 550 sequences, byte tables, RLE compression, error recovery
├── demo.md             renders <LiveDemo />
├── api/                auto-generated via typedoc
└── .vitepress/
    ├── config.ts
    ├── components/
    │   └── LiveDemo.vue
    └── theme/
        └── index.ts
```

All pages fully authored — complete prose, real API examples, no placeholders.

### 9.2 NFC Lock Documentation

The 550 series NFC lock must be documented prominently in multiple places:
- `index.md`: a callout card "550 series requires genuine Dymo labels"
- `getting-started.md`: dedicated subsection explaining what the NFC lock is,
  which models are affected, and that it cannot be bypassed
- `hardware.md`: NFC lock column in the device table + explanation
- `core.md`: note that the 550 protocol job header does not disable NFC checking

### 9.3 Live Browser Demo (`LiveDemo.vue`)

- Connects via WebUSB; text input; density and mode selectors
- Live 1bpp bitmap preview on every keystroke
- Chrome/Edge only note
- NFC lock note for 550 series users

### 9.4 VitePress Config

```typescript
import { defineConfig } from 'vitepress';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  title: 'labelwriter',
  description: 'TypeScript driver for Dymo LabelWriter label printers — USB, TCP, WebUSB',
  base: '/labelwriter/',
  ignoreDeadLinks: [
    /^\.\/LICENSE$/,
    /^\.\/(cli|core|node|web)\/dist\/README$/,
  ],
  themeConfig: {
    nav: [
      { text: 'Get started', link: '/getting-started' },
      { text: 'Node.js', link: '/node' },
      { text: 'CLI', link: '/cli' },
      { text: 'Web', link: '/web' },
      { text: 'Hardware', link: '/hardware' },
      { text: 'Core', link: '/core' },
    ],
    sidebar: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Node.js', link: '/node' },
      { text: 'CLI', link: '/cli' },
      { text: 'Web', link: '/web' },
      { text: 'Hardware', link: '/hardware' },
      { text: 'Core', link: '/core' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/thermal-label/labelwriter' }],
    search: { provider: 'local' },
  },
  vite: {
    resolve: {
      alias: {
        '@thermal-label/labelwriter-web': fileURLToPath(
          new URL('../../packages/web/src/index.ts', import.meta.url),
        ),
      },
    },
  },
})
```

---

## 10. CI/CD

### `ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v5
        with:
          version: 9

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm prettier --check "packages/**/*.ts"

      - name: Test with coverage
        run: pnpm test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          flags: unittests
          fail_ci_if_error: true

      - name: Build
        run: pnpm build
```

### `release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write
  id-token: write

jobs:
  release:
    name: Publish & Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v5
        with:
          version: 9

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Verify version matches tag
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          for pkg in packages/*/package.json; do
            PKG_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('$pkg','utf8')).version")
            if [ "$PKG_VERSION" != "$TAG" ]; then
              echo "❌ Version mismatch in $pkg: expected $TAG, got $PKG_VERSION"
              exit 1
            fi
          done
          echo "✅ All versions match tag $TAG"

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Publish
        run: pnpm release

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          make_latest: true
```

### `docs.yml`

```yaml
name: Docs

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy docs
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v5
        with:
          version: 9

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Generate API reference
        run: pnpm docs:api

      - name: Build docs
        run: pnpm docs:build

      - uses: actions/upload-pages-artifact@v5
        with:
          path: docs/.vitepress/dist

      - uses: actions/deploy-pages@v5
        id: deployment
```

---

## 11. Root `README.md`

```markdown
[![CI](https://github.com/thermal-label/labelwriter/actions/workflows/ci.yml/badge.svg)](https://github.com/thermal-label/labelwriter/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/thermal-label/labelwriter/branch/main/graph/badge.svg)](https://codecov.io/gh/thermal-label/labelwriter)
[![npm core](https://img.shields.io/npm/v/@thermal-label/labelwriter-core)](https://npmjs.com/package/@thermal-label/labelwriter-core)
[![npm node](https://img.shields.io/npm/v/@thermal-label/labelwriter-node)](https://npmjs.com/package/@thermal-label/labelwriter-node)
[![npm web](https://img.shields.io/npm/v/@thermal-label/labelwriter-web)](https://npmjs.com/package/@thermal-label/labelwriter-web)
[![npm cli](https://img.shields.io/npm/v/@thermal-label/labelwriter-cli)](https://npmjs.com/package/@thermal-label/labelwriter-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# labelwriter

TypeScript-first Dymo LabelWriter driver suite for Node.js, browser WebUSB, and CLI.

- Project website: https://thermal-label.github.io/labelwriter/
- Repository: https://github.com/thermal-label/labelwriter
- Issues: https://github.com/thermal-label/labelwriter/issues

> **Note for LabelWriter 550 / 5XL users:** These models enforce an NFC label
> lock — only genuine Dymo labels will print. This is a hardware restriction
> that cannot be bypassed. See the [hardware guide](https://thermal-label.github.io/labelwriter/hardware)
> for details.

## Install

```bash
pnpm add @thermal-label/labelwriter-node   # Node.js
pnpm add @thermal-label/labelwriter-web    # Browser
npm install -g @thermal-label/labelwriter-cli  # CLI
```

## Quick Start

### Node.js
```ts
import { openPrinter } from '@thermal-label/labelwriter-node';
const printer = await openPrinter();
await printer.printText('Hello LabelWriter');
await printer.close();
```

### Browser (WebUSB)
```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';
const printer = await requestPrinter();
await printer.printText('Hello WebUSB');
```

### CLI
```bash
labelwriter list
labelwriter print text "Hello World"
```

## Packages

- `@thermal-label/labelwriter-core` — protocol encoding and device registry
- `@thermal-label/labelwriter-node` — Node.js USB (libusb) and TCP transport
- `@thermal-label/labelwriter-web` — browser WebUSB transport
- `@thermal-label/labelwriter-cli` — `labelwriter` CLI tool

## License

MIT
```

---

## 12. Implementation Sequence

```
1. Scaffold
   - LICENSE, .github/FUNDING.yml, .github/ISSUE_TEMPLATE/hardware_verification.md
   - Root package.json, eslint.config.js, tsconfig.base.json, pnpm-workspace.yaml, .gitignore
   - .changeset/ directory
   - GitHub Actions: ci.yml, release.yml, docs.yml
   - HARDWARE.md (device table, NFC lock section, protocol generation section)
   - Root README.md (per section 11)
   - PROGRESS.md with all steps and substeps as checkboxes
   - pnpm install — must complete without errors

2. @thermal-label/labelwriter-core
   - package.json + README.md
   - src/types.ts
   - src/devices.ts — full device registry
   - src/protocol.ts — all encoder functions, both 450 and 550 protocol
   - src/__tests__/ — all tests
   - Gate: typecheck + lint + test + build

3. @thermal-label/labelwriter-node
   - package.json + README.md
   - UsbTransport (real usb types, no wrappers)
   - TcpTransport (net.Socket, handle partial reads, 1 or 32 byte status)
   - LabelWriterPrinter class (close() always in finally)
   - Discovery (listPrinters)
   - Mocked unit tests; integration test stubs with hardware checklists
   - Gate: typecheck + lint + test + build

4. @thermal-label/labelwriter-cli
   - package.json + README.md; all commands; tests
   - Gate: typecheck + lint + test + build

5. @thermal-label/labelwriter-web
   - package.json + README.md; WebUSB transport; WebLabelWriterPrinter; mocked tests
   - Gate: typecheck + lint + test + build

6. Docs
   - VitePress config + theme + LiveDemo.vue
   - All pages fully authored (index, getting-started, node, cli, web, hardware, core, demo)
   - NFC lock prominently documented in multiple pages
   - API reference via typedoc
   - Gate: docs:build completes without errors

7. Final
   - Run pnpm test:coverage — verify 90% thresholds across all packages
   - Verify all PROGRESS.md checkboxes ticked
   - Verify ci.yml passes locally
```

---

## 13. Key Constraints & Agent Notes

- **USB transport uses `usb` package (libusb), not `node-hid`** — LabelWriter is Printer Class, not HID
- **Use real `usb` package types** — no wrapper interfaces, no `as unknown as`
- **`usb` read returns `Buffer`** — convert with `new Uint8Array(buffer)`
- **`close()` is always async** — always await, always call in `finally`
- **Bitmap orientation**: fit to head width BEFORE rotating — `padBitmap` or
  `scaleBitmap` to `bytesPerRow * 8` dots first, then `rotateBitmap(bitmap, 90)`
- **Protocol generation matters**: 450 devices — no job header; 550 devices —
  `buildJobHeader()` is mandatory before any raster data. Check `device.protocol`
- **Status response size**: 450 series = 1 byte; 550 series = 32 bytes.
  Read the correct number based on `device.protocol`
- **Error recovery**: expose `recover()` on the printer class — sends 85 ESC
  bytes + status request. Essential for recovering from failed print jobs
- **NFC lock**: document prominently, do nothing special in code. The printer
  enforces it — the driver just needs to explain it clearly to users
- **Twin Turbo roll select**: `buildSelectRoll(roll)` must be called before
  raster data when `options.roll` is specified
- **Web package** extends `@mbtech-nl/tsconfig/browser` directly
- **Every package must be publish-ready** — complete `package.json` (name,
  description, keywords, version, exports, files, engines, publishConfig,
  funding, sideEffects, repository, bugs, homepage) and a complete `README.md`
  per section 4.9. Do not mark a package step done until both are complete.
- **`publishConfig: { access: "public" }`** in every package.json
- **`types: "./src/index.ts"`** in core package.json
- **`pnpm prettier --check`** in CI (not bare `prettier --check`)
- **`sideEffects: false`** in all package.json files
- **Changesets** for versioning
- **Coverage thresholds enforced only at step 7**