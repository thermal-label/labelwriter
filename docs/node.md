# Node.js package

`@thermal-label/labelwriter-node` provides USB and TCP transport
integration and the `LabelWriterPrinter` class — implementing the
`PrinterAdapter` interface from
[`@thermal-label/contracts`](https://www.npmjs.com/package/@thermal-label/contracts),
built on
[`@thermal-label/transport`](https://www.npmjs.com/package/@thermal-label/transport).

## Install

```bash
pnpm add @thermal-label/labelwriter-node
```

---

## The adapter

`LabelWriterPrinter` implements `PrinterAdapter`. Every `@thermal-label/*`
driver exports the same surface, so application code never branches
on family:

| Method                                      | Description                                       |
| ------------------------------------------- | ------------------------------------------------- |
| `print(image, media?, options?)`            | Print one label; accepts full RGBA                |
| `createPreview(image, options?)`            | Render the 1bpp plane for UI previews             |
| `getStatus()`                               | `PrinterStatus` — ready, media, errors, raw bytes |
| `close()`                                   | Release the transport                             |
| `family` / `model` / `device` / `connected` | Identification                                    |
| `recover()`                                 | (driver extension) send error-recovery sequence   |

---

## Discovery

```ts
import { discovery } from '@thermal-label/labelwriter-node';

const printers = await discovery.listPrinters();
// [{ device, serialNumber, transport: 'usb', connectionId: '1:2' }, ...]

// First matching USB printer
const printer = await discovery.openPrinter();

// Specific serial
const specific = await discovery.openPrinter({ serialNumber: 'AB1234' });

// Target the LabelWriter 550
const lw550 = await discovery.openPrinter({ vid: 0x0922, pid: 0x0052 });
```

`discovery` is also exported as a named singleton so the unified
[`thermal-label-cli`](https://www.npmjs.com/package/thermal-label-cli)
can pick it up automatically.

**TCP printers** (550 Turbo / 5XL / Wireless) are not surfaced by
`listPrinters()` — there is no mDNS implementation. Open them
explicitly by host:

```ts
const printer = await discovery.openPrinter({ host: '192.168.1.100' });
const custom = await discovery.openPrinter({ host: '10.0.0.5', port: 9200 });
```

---

## Printing

```ts
import { discovery } from '@thermal-label/labelwriter-node';
import { MEDIA } from '@thermal-label/labelwriter-core';

const printer = await discovery.openPrinter();
try {
  await printer.print(image, MEDIA.ADDRESS_STANDARD, {
    density: 'high',
    copies: 2,
  });
} finally {
  await printer.close();
}
```

`image` is `RawImageData` — `{ width, height, data }` with `data` as
RGBA `Uint8Array`. Any image pipeline that outputs RGBA works —
`@napi-rs/canvas`, `sharp`, `node-canvas`, or a pre-rendered buffer
from a design tool.

### Options

| Option     | Type                                        | Default    | Description                                       |
| ---------- | ------------------------------------------- | ---------- | ------------------------------------------------- |
| `density`  | `'light' \| 'medium' \| 'normal' \| 'high'` | `'normal'` | Print density                                     |
| `copies`   | `number`                                    | `1`        | Copies to print                                   |
| `compress` | `boolean`                                   | `false`    | Enable RLE compression                            |
| `mode`     | `'text' \| 'graphics'`                      | `'text'`   | Print mode hint                                   |
| `roll`     | `0 \| 1`                                    | undefined  | Roll selector (Twin Turbo / 450 Duo)              |
| `jobId`    | `number`                                    | auto       | 550-series job ID (auto-filled from `Date.now()`) |

### Media

```ts
import { MEDIA, type LabelWriterMedia } from '@thermal-label/labelwriter-core';

MEDIA.ADDRESS_STANDARD; // 89×28 mm — DEFAULT_MEDIA for previews
MEDIA.ADDRESS_LARGE; // 89×36 mm
MEDIA.SHIPPING_STANDARD; // 102×59 mm
MEDIA.SHIPPING_LARGE; // 102×159 mm
MEDIA.FILE_FOLDER; // 19×87 mm
MEDIA.CONTINUOUS_56MM; // 56 mm continuous
```

On **LabelWriter 550 / 550 Turbo / 5XL**, `getStatus()` populates
`detectedMedia` from the 32-byte status response. Subsequent
`print()` calls without an explicit `media` argument will reuse the
detection automatically. On the **LabelWriter 450 series**, media
detection isn't available — pass `media` explicitly or
`print()` throws `MediaNotSpecifiedError`.

---

## Status

```ts
const status = await printer.getStatus();

status.ready; // printer idle and error-free
status.mediaLoaded; // tape / label roll present
status.detectedMedia; // LabelWriterMedia | undefined (550 only)
status.errors; // PrinterError[] with { code, message }
status.rawBytes; // raw status response for diagnostics
```

Error codes:

| Code             | Meaning                      |
| ---------------- | ---------------------------- |
| `not_ready`      | Printer is busy              |
| `no_media`       | No labels loaded / paper out |
| `label_too_long` | Label exceeded max length    |
| `paper_jam`      | Paper jam detected (550)     |
| `cover_open`     | Cover is open (550)          |

---

## Error recovery

After a jam / paper-out / label-too-long error, send the recovery
sequence:

```ts
await printer.recover();
const status = await printer.getStatus();
```

`recover()` is a driver-specific extension on `LabelWriterPrinter`,
not part of `PrinterAdapter`.

---

## API summary

| Export                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `discovery`            | `PrinterDiscovery` singleton — enumerate & open |
| `LabelWriterDiscovery` | Class form, for a second instance               |
| `LabelWriterPrinter`   | Adapter class (directly or via `discovery`)     |
