# @thermal-label/labelwriter-core

Protocol encoding and device registry for Dymo LabelWriter printers.

> **Note:** Most applications should use `@thermal-label/labelwriter-node` (Node.js) or
> `@thermal-label/labelwriter-web` (browser) instead of importing this package directly.

## Install

```bash
pnpm add @thermal-label/labelwriter-core
```

## Requirements

- Node.js >= 24.0.0 (or any modern browser)

## Key Exports

### Device Registry

```ts
import { DEVICES, findDevice } from '@thermal-label/labelwriter-core';

const device = findDevice(0x0922, 0x0020); // LabelWriter 450
console.log(device?.name); // 'LabelWriter 450'

// All known devices
console.log(Object.keys(DEVICES));
```

### Protocol Encoding

```ts
import { encodeLabel, buildErrorRecovery } from '@thermal-label/labelwriter-core';

const bytes = encodeLabel(device, bitmap, { density: 'normal', mode: 'text' });
const recovery = buildErrorRecovery();
```

### Bitmap Helpers (re-exported from `@mbtech-nl/bitmap`)

```ts
import {
  renderText,
  renderImage,
  rotateBitmap,
  padBitmap,
  scaleBitmap,
} from '@thermal-label/labelwriter-core';
```

## Types

```ts
interface DeviceDescriptor {
  name: string;
  vid: number;
  pid: number;
  headDots: number; // 672 or 1248
  bytesPerRow: number; // headDots / 8 = 84 or 156
  protocol: '450' | '550';
  network: 'none' | 'wifi' | 'wired';
  nfcLock: boolean; // 550 series — genuine labels only
}

interface PrintOptions {
  density?: 'light' | 'medium' | 'normal' | 'high';
  mode?: 'text' | 'graphics';
  compress?: boolean;
  copies?: number;
  roll?: 0 | 1; // Twin Turbo only
  jobId?: number; // 550 protocol — auto-generated if omitted
}
```

## Protocol Generations

The protocol generation is detected automatically from the `DeviceDescriptor`:

- **450 series** (`protocol: '450'`): no job header, simple ESC/raster stream
- **550 series** (`protocol: '550'`): mandatory `ESC s` job header before raster data

The 550 series NFC lock cannot be bypassed — the printer hardware enforces it.
See [HARDWARE.md](../../HARDWARE.md) for details.

## Links

- [Documentation](https://thermal-label.github.io/labelwriter/)
- [GitHub](https://github.com/thermal-label/labelwriter)

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

MIT — Copyright (c) 2026 Mannes Brak
