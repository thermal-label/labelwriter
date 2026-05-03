# Core

`@thermal-label/labelwriter-core` is the shared protocol layer used by
both the Node.js and Web packages. It contains the ESC/raster
encoder, the 450 / 550 / Duo-tape status parsers, the device and
media registries, and the offline preview helper. It also re-exports
the `@thermal-label/contracts` base types.

Consume `*-core` directly when you need the protocol encoder or
offline preview without a live printer.

::: tip Looking for byte-level details?
The wire protocols are documented separately:

- [LW 450 raster](./protocol/lw-450) — LabelWriter 300 / 400 / 450 / 4XL.
- [LW 550 raster](./protocol/lw-550) — LabelWriter 550 / 550 Turbo / 5XL.
- [Duo tape](./protocol/duo-tape) — LabelWriter Duo's tape engine.

This page documents the `*-core` API surface that emits and parses
those byte streams.
:::

## Install

```bash
pnpm add @thermal-label/labelwriter-core
```

## Core exports

| Export                                                               | Description                                                                 |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `DEVICES` / `findDevice`                                             | Device registry (family, transports, engines)                               |
| `MEDIA` / `DEFAULT_MEDIA`                                            | Media registry and the 89×28 mm fallback for assumed previews               |
| `findMediaByDimensions(w, h)`                                        | Match a 550-status response to a registry entry                             |
| `STATUS_REQUEST` / `buildStatusRequest(device, lock?)`               | Static `ESC A` (450) or device-aware status request (550)                   |
| `parseStatus(device, bytes)`                                         | Parse the status response into `PrinterStatus` (1 / 32 / 8 bytes)           |
| `statusByteCount(device)`                                            | 1 for `lw-450`, 32 for `lw-550`, 8 for `d1-tape`                            |
| `createPreviewOffline(image, media)`                                 | Render `PreviewResult` without a live printer connection                    |
| `encodeLabel(device, bitmap, opts)`                                  | Full job byte stream for `lw-450` and `lw-550` engines                      |
| `encodeDuoTapeLabel(device, bitmap, opts)`                           | Full job byte stream for the Duo's tape engine (`d1-tape`)                  |
| `isEngineDrivable(engine)` / `isDuoTapeEngine(engine)`               | Routing helpers for adapters with multiple engines                          |
| `buildReset`, `buildDensity`, `buildRasterRow`, `build550…`, `buildDuo…` | Per-command byte builders                                               |
| `parseSkuInfo(bytes)` / `parseEngineVersion(bytes)`                  | Parsers for `ESC U` / `ESC V` 550-family responses                          |
| `LabelWriterDevice`                                                  | Device descriptor type (extends contracts `DeviceDescriptor`)               |
| `LabelWriterMedia`                                                   | Media descriptor type (extends contracts `MediaDescriptor`)                 |
| `LabelWriterPrintOptions`                                            | Protocol options (`density`, `mode`, `compress`, `copies`, `engine`, `jobId`) |
| `Density`                                                            | `'light' \| 'medium' \| 'normal' \| 'high'`                                 |
| `PrinterAdapter`, `MediaDescriptor`, `PrinterStatus`, `Transport`, … | Re-exported from `@thermal-label/contracts`                                 |

## Encoding a label

```ts
import { encodeLabel, DEVICES, type LabelBitmap } from '@thermal-label/labelwriter-core';

const bitmap: LabelBitmap = {
  widthPx: 672,
  heightPx: 200,
  data: new Uint8Array((672 / 8) * 200),
};
const bytes = encodeLabel(DEVICES.LW_450, bitmap);
// bytes is a Uint8Array ready to send to the printer transport
```

`encodeLabel` reads `engine.protocol` and dispatches to the right
encoder — `lw-450` or `lw-550`. For the LabelWriter Duo's tape side,
use `encodeDuoTapeLabel(device, bitmap, opts)` instead and route to
`bInterfaceNumber 1` via the transport's interface-number option.

## Per-protocol routing

| Engine `protocol` | Encoder entry point     | Status reply size | Spec source |
| ----------------- | ----------------------- | ----------------: | ----------- |
| `lw-450`          | `encodeLabel(device, …)` | 1 byte            | LW 450 Series Tech Ref |
| `lw-550`          | `encodeLabel(device, …)` (dispatched internally) | 32 bytes | LW 550 Tech Ref |
| `d1-tape`         | `encodeDuoTapeLabel(device, …)` | 8 bytes  | LW 450 Series Tech Ref, App. B |

Adapters with multiple engines (LabelWriter Duo) pick the right
encoder via `isEngineDrivable(engine)` (true for `lw-450` and
`lw-550`) and `isDuoTapeEngine(engine)` (true for `d1-tape`).
