# @thermal-label/labelwriter-core

Protocol encoding and device registry for Dymo LabelWriter printers.

> **Note:** Most applications should use `@thermal-label/labelwriter-node` (Node.js) or
> `@thermal-label/labelwriter-web` (browser) instead of importing this package directly.

## Install

```bash
pnpm add @thermal-label/labelwriter-core
```

## Requirements

- Node.js >= 20.9.0 (Node 24 LTS recommended) — or any modern browser

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

## Supported hardware

<!-- HARDWARE_TABLE:START -->

**22 devices** — 1 verified · 0 partial · 0 broken · 21 untested

| Model                                                                                                | Key                 | USB PID | Transports  | Status      |
| ---------------------------------------------------------------------------------------------------- | ------------------- | ------- | ----------- | ----------- |
| [LabelWriter 4XL](https://thermal-label.github.io/hardware/labelwriter/lw-4xl)                       | `LW_4XL`            | 0x001f  | USB         | ⏳ untested |
| [LabelWriter 5XL](https://thermal-label.github.io/hardware/labelwriter/lw-5xl)                       | `LW_5XL`            | 0x002a  | USB, TCP    | ⏳ untested |
| [LabelWriter 300](https://thermal-label.github.io/hardware/labelwriter/lw-300)                       | `LW_300`            | 0x0009  | USB, Serial | ⏳ untested |
| [LabelWriter 310](https://thermal-label.github.io/hardware/labelwriter/lw-310)                       | `LW_310`            | 0x0009  | USB, Serial | ⏳ untested |
| [LabelWriter 330](https://thermal-label.github.io/hardware/labelwriter/lw-330)                       | `LW_330`            | 0x0007  | USB, Serial | ⏳ untested |
| [LabelWriter 330 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-330-turbo)           | `LW_330_TURBO`      | 0x0008  | USB, Serial | ✅ verified |
| [LabelWriter 400](https://thermal-label.github.io/hardware/labelwriter/lw-400)                       | `LW_400`            | 0x0019  | USB         | ⏳ untested |
| [LabelWriter 400 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-400-turbo)           | `LW_400_TURBO`      | 0x001a  | USB         | ⏳ untested |
| [LabelWriter 450](https://thermal-label.github.io/hardware/labelwriter/lw-450)                       | `LW_450`            | 0x0020  | USB         | ⏳ untested |
| [LabelWriter 450 Duo](https://thermal-label.github.io/hardware/labelwriter/lw-450-duo)               | `LW_450_DUO`        | 0x0023  | USB         | ⏳ untested |
| [LabelWriter 450 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-450-turbo)           | `LW_450_TURBO`      | 0x0021  | USB         | ⏳ untested |
| [LabelWriter 450 Twin Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-450-twin-turbo) | `LW_450_TWIN_TURBO` | 0x0022  | USB         | ⏳ untested |
| [LabelWriter 550](https://thermal-label.github.io/hardware/labelwriter/lw-550)                       | `LW_550`            | 0x0028  | USB         | ⏳ untested |
| [LabelWriter 550 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-550-turbo)           | `LW_550_TURBO`      | 0x0029  | USB, TCP    | ⏳ untested |
| [LabelWriter Duo - 96](https://thermal-label.github.io/hardware/labelwriter/lw-duo-96)               | `LW_DUO_96`         | 0x0017  | USB         | ⏳ untested |
| [LabelWriter Duo - 128](https://thermal-label.github.io/hardware/labelwriter/lw-duo-128)             | `LW_DUO_128`        | 0x001d  | USB         | ⏳ untested |
| [LabelWriter EL40](https://thermal-label.github.io/hardware/labelwriter/lw-el40)                     | `LW_EL40`           | —       | Serial      | ⏳ untested |
| [LabelWriter EL60](https://thermal-label.github.io/hardware/labelwriter/lw-el60)                     | `LW_EL60`           | —       | Serial      | ⏳ untested |
| [LabelWriter SE450](https://thermal-label.github.io/hardware/labelwriter/lw-se450)                   | `LW_SE450`          | 0x0400  | USB, Serial | ⏳ untested |
| [LabelWriter Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-turbo)                   | `LW_TURBO`          | —       | Serial      | ⏳ untested |
| [LabelWriter Twin Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-twin-turbo)         | `LW_TWIN_TURBO`     | 0x0018  | USB         | ⏳ untested |
| [LabelWriter Wireless](https://thermal-label.github.io/hardware/labelwriter/lw-wireless)             | `LW_WIRELESS`       | 0x0031  | USB, TCP    | ⏳ untested |

Click any model to open its detail page on the docs site, where engines, supported media, and verification reports live. The same data backs the [interactive cross-driver table](https://thermal-label.github.io/hardware/).

<!-- HARDWARE_TABLE:END -->

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

MIT — Copyright (c) 2026 Mannes Brak
