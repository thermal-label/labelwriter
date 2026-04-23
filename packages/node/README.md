# @thermal-label/labelwriter-node

Node.js USB and TCP driver for Dymo LabelWriter printers.

## Install

```bash
pnpm add @thermal-label/labelwriter-node
```

## Requirements

- Node.js >= 24.0.0
- Linux: udev rule required for raw USB access without `sudo` — see below

> **LabelWriter 550 / 5XL:** These models enforce an NFC label lock. Only genuine Dymo labels
> will print. This is a hardware restriction that cannot be bypassed in software.

## Quick Start

```ts
import { openPrinter } from '@thermal-label/labelwriter-node';

const printer = await openPrinter();
try {
  await printer.printText('Hello LabelWriter');
} finally {
  await printer.close();
}
```

## Discovery

```ts
import { listPrinters } from '@thermal-label/labelwriter-node';

const printers = listPrinters();
console.log(printers); // [{ device, serialNumber, path, transport }]
```

## TCP / Network

```ts
import { openPrinterTcp } from '@thermal-label/labelwriter-node';

const printer = await openPrinterTcp('192.168.1.100');
await printer.printText('Hello via TCP');
await printer.close();
```

## Image Printing

Requires optional dependency `@napi-rs/canvas`:

```bash
pnpm add @napi-rs/canvas
```

```ts
await printer.printImage('/path/to/logo.png', { threshold: 128 });
await printer.printImage('./label.png', { dither: true, rotate: 90 });
```

## Error Recovery

If the printer is in an unknown state (e.g. after a failed print job):

```ts
await printer.recover();
```

## Linux udev Rule

Without a udev rule, USB access requires `sudo`. Create `/etc/udev/rules.d/99-dymo-labelwriter.rules`:

```
SUBSYSTEM=="usb", ATTR{idVendor}=="0922", MODE="0666", GROUP="plugdev"
```

Then reload:

```bash
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Links

- [Documentation](https://thermal-label.github.io/labelwriter/)
- [GitHub](https://github.com/thermal-label/labelwriter)

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

MIT — Copyright (c) 2026 Mannes Brak
