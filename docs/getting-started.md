# Getting started

## Node.js

### Install

```bash
pnpm add @thermal-label/labelwriter-node
```

### Print over USB

```ts
import { discovery } from '@thermal-label/labelwriter-node';
import { MEDIA } from '@thermal-label/labelwriter-core';

const printer = await discovery.openPrinter();
try {
  // image is `RawImageData` — `{ width, height, data }` where `data` is a
  // `Uint8Array` of RGBA pixels. Produce it from @napi-rs/canvas, sharp,
  // or any server-side image pipeline.
  await printer.print(image, MEDIA.ADDRESS_STANDARD);
} finally {
  await printer.close();
}
```

### Print over TCP (network-attached models)

```ts
import { discovery } from '@thermal-label/labelwriter-node';
import { MEDIA } from '@thermal-label/labelwriter-core';

const printer = await discovery.openPrinter({ host: '192.168.1.100' });
try {
  await printer.print(image, MEDIA.SHIPPING_STANDARD, { density: 'high' });
} finally {
  await printer.close();
}
```

### Linux udev rule

USB access on Linux requires a udev rule. Create
`/etc/udev/rules.d/99-labelwriter.rules`:

```
SUBSYSTEM=="usb", ATTR{idVendor}=="0922", GROUP="plugdev", MODE="0664"
```

Then reload rules and add your user to the `plugdev` group:

```bash
sudo udevadm control --reload-rules
sudo usermod -aG plugdev $USER
```

Log out and back in for the group change to take effect.

## Unified CLI

For ad-hoc printing from a terminal, use
[`thermal-label-cli`](https://www.npmjs.com/package/thermal-label-cli).
It auto-detects every installed `@thermal-label/*-node` driver:

```bash
pnpm add -g thermal-label-cli @thermal-label/labelwriter-node
thermal-label list
thermal-label print ./label.png --media address-standard
```

## Web (browser)

### Install

```bash
pnpm add @thermal-label/labelwriter-web
```

Requires Chrome or Edge (WebUSB is not supported in Firefox or Safari),
served from a secure context (`https://` or `localhost`).

### Quick start

```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';
import { MEDIA } from '@thermal-label/labelwriter-core';

// Must run from a user gesture (click handler, etc.)
const printer = await requestPrinter();
try {
  await printer.print(image, MEDIA.ADDRESS_STANDARD);
} finally {
  await printer.close();
}
```

## NFC label lock

### What is it?

The Dymo LabelWriter 550 series (550, 550 Turbo, 5XL, and related
models) includes hardware-level NFC validation. Before printing, the
printer reads an NFC chip embedded in the label roll. If the chip is
absent or not recognised as a genuine Dymo label, the printer reports
a paper-out error and refuses to print.

### Which models are affected?

All `protocol: '550'` devices — see [Hardware](./hardware) for the full
list. The 450 series and older models do not have this restriction.

### Can it be bypassed?

**No.** The NFC check is performed entirely within the printer's own
firmware, independent of the host software. There is no command or
sequence that disables it. Using genuine Dymo-certified label rolls is
the only solution.

### What does the error look like?

`getStatus()` returns a `PrinterStatus` whose `errors[]` contains a
`{ code: 'no_media', message: 'No labels loaded' }` entry and whose
`ready` is `false`. The printer also shows a blinking orange LED.
