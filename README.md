# @thermal-label/labelwriter

> TypeScript-first DYMO LabelWriter driver — Node USB/TCP and browser WebUSB.

[![CI](https://github.com/thermal-label/labelwriter/actions/workflows/ci.yml/badge.svg)](https://github.com/thermal-label/labelwriter/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/thermal-label/labelwriter/branch/main/graph/badge.svg)](https://codecov.io/gh/thermal-label/labelwriter)
[![npm core](https://img.shields.io/npm/v/@thermal-label/labelwriter-core.svg?label=core)](https://npmjs.com/package/@thermal-label/labelwriter-core)
[![npm node](https://img.shields.io/npm/v/@thermal-label/labelwriter-node.svg?label=node)](https://npmjs.com/package/@thermal-label/labelwriter-node)
[![npm web](https://img.shields.io/npm/v/@thermal-label/labelwriter-web.svg?label=web)](https://npmjs.com/package/@thermal-label/labelwriter-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **LabelWriter 550 / 5XL users:** These models enforce an NFC label lock —
> only genuine DYMO labels will print. This is a hardware restriction that
> cannot be bypassed. See the [hardware guide](https://thermal-label.github.io/labelwriter/hardware)
> before buying media.

## Install

```bash
pnpm add @thermal-label/labelwriter-node    # Node USB/TCP
pnpm add @thermal-label/labelwriter-web     # Browser WebUSB
```

For ad-hoc printing from the terminal, install
[`thermal-label-cli`](https://www.npmjs.com/package/thermal-label-cli) — it
auto-detects every installed driver, no per-driver CLI needed.

## Quick example (Node)

```ts
import { discovery } from '@thermal-label/labelwriter-node';
import { MEDIA } from '@thermal-label/labelwriter-core';

const printer = await discovery.openPrinter();
try {
  // image is RawImageData — { width, height, data } where data is RGBA bytes.
  await printer.print(image, MEDIA.ADDRESS_STANDARD);
} finally {
  await printer.close();
}
```

## Quick example (Browser)

```ts
import { requestPrinter } from '@thermal-label/labelwriter-web';
import { MEDIA } from '@thermal-label/labelwriter-core';

const printer = await requestPrinter(); // call from a user gesture
try {
  await printer.print(image, MEDIA.ADDRESS_STANDARD);
} finally {
  await printer.close();
}
```

## Supported hardware

<!-- HARDWARE_TABLE:START -->
**22 devices** — 1 verified · 0 partial · 0 broken · 21 untested

| Model | Key | USB PID | Transports | Status |
| --- | --- | --- | --- | --- |
| [LabelWriter 4XL](https://thermal-label.github.io/hardware/labelwriter/lw-4xl) | `LW_4XL` | 0x001f | USB | ⏳ untested |
| [LabelWriter 5XL](https://thermal-label.github.io/hardware/labelwriter/lw-5xl) | `LW_5XL` | 0x002a | USB, TCP | ⏳ untested |
| [LabelWriter 300](https://thermal-label.github.io/hardware/labelwriter/lw-300) | `LW_300` | 0x0009 | USB, Serial | ⏳ untested |
| [LabelWriter 310](https://thermal-label.github.io/hardware/labelwriter/lw-310) | `LW_310` | 0x0009 | USB, Serial | ⏳ untested |
| [LabelWriter 330](https://thermal-label.github.io/hardware/labelwriter/lw-330) | `LW_330` | 0x0007 | USB, Serial | ⏳ untested |
| [LabelWriter 330 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-330-turbo) | `LW_330_TURBO` | 0x0008 | USB, Serial | ✅ verified |
| [LabelWriter 400](https://thermal-label.github.io/hardware/labelwriter/lw-400) | `LW_400` | 0x0019 | USB | ⏳ untested |
| [LabelWriter 400 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-400-turbo) | `LW_400_TURBO` | 0x001a | USB | ⏳ untested |
| [LabelWriter 450](https://thermal-label.github.io/hardware/labelwriter/lw-450) | `LW_450` | 0x0020 | USB | ⏳ untested |
| [LabelWriter 450 Duo](https://thermal-label.github.io/hardware/labelwriter/lw-450-duo) | `LW_450_DUO` | 0x0023 | USB | ⏳ untested |
| [LabelWriter 450 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-450-turbo) | `LW_450_TURBO` | 0x0021 | USB | ⏳ untested |
| [LabelWriter 450 Twin Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-450-twin-turbo) | `LW_450_TWIN_TURBO` | 0x0022 | USB | ⏳ untested |
| [LabelWriter 550](https://thermal-label.github.io/hardware/labelwriter/lw-550) | `LW_550` | 0x0028 | USB | ⏳ untested |
| [LabelWriter 550 Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-550-turbo) | `LW_550_TURBO` | 0x0029 | USB, TCP | ⏳ untested |
| [LabelWriter Duo - 96](https://thermal-label.github.io/hardware/labelwriter/lw-duo-96) | `LW_DUO_96` | 0x0017 | USB | ⏳ untested |
| [LabelWriter Duo - 128](https://thermal-label.github.io/hardware/labelwriter/lw-duo-128) | `LW_DUO_128` | 0x001d | USB | ⏳ untested |
| [LabelWriter EL40](https://thermal-label.github.io/hardware/labelwriter/lw-el40) | `LW_EL40` | — | Serial | ⏳ untested |
| [LabelWriter EL60](https://thermal-label.github.io/hardware/labelwriter/lw-el60) | `LW_EL60` | — | Serial | ⏳ untested |
| [LabelWriter SE450](https://thermal-label.github.io/hardware/labelwriter/lw-se450) | `LW_SE450` | 0x0400 | USB, Serial | ⏳ untested |
| [LabelWriter Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-turbo) | `LW_TURBO` | — | Serial | ⏳ untested |
| [LabelWriter Twin Turbo](https://thermal-label.github.io/hardware/labelwriter/lw-twin-turbo) | `LW_TWIN_TURBO` | 0x0018 | USB | ⏳ untested |
| [LabelWriter Wireless](https://thermal-label.github.io/hardware/labelwriter/lw-wireless) | `LW_WIRELESS` | 0x0031 | USB, TCP | ⏳ untested |

Click any model to open its detail page on the docs site, where engines, supported media, and verification reports live. The same data backs the [interactive cross-driver table](https://thermal-label.github.io/hardware/).
<!-- HARDWARE_TABLE:END -->

## Documentation

Full docs at **<https://thermal-label.github.io/labelwriter/>**.

- [Getting started](https://thermal-label.github.io/labelwriter/getting-started)
- [Hardware list](https://thermal-label.github.io/labelwriter/hardware) (incl. NFC-lock model list)
- [Wire protocols](https://thermal-label.github.io/labelwriter/protocol/) — [LW 450](https://thermal-label.github.io/labelwriter/protocol/lw-450) · [LW 550](https://thermal-label.github.io/labelwriter/protocol/lw-550) · [Duo tape](https://thermal-label.github.io/labelwriter/protocol/duo-tape)
- [Node guide](https://thermal-label.github.io/labelwriter/node)
- [Web guide](https://thermal-label.github.io/labelwriter/web)
- [API reference](https://thermal-label.github.io/labelwriter/api/)
- [Live demo](https://thermal-label.github.io/demo/labelwriter)

## Packages

| Package | Role |
|---|---|
| `@thermal-label/labelwriter-core` | Protocol encoding, device + media registries. Browser + Node. |
| `@thermal-label/labelwriter-node` | Node USB (libusb) and TCP transport. |
| `@thermal-label/labelwriter-web` | Browser WebUSB transport. |

The per-driver `*-cli` package was retired — use the unified
[`thermal-label-cli`](https://www.npmjs.com/package/thermal-label-cli) instead.

## Compatibility

| | |
|---|---|
| Node | ≥ 20.9 (Node 24 LTS recommended) |
| Browsers | Chrome / Edge 89+, secure context (`https://` or `localhost`) |
| Linux | typically needs a `udev` rule for `0922:*` to access without `sudo` |
| Devices | LabelWriter 450 series (no NFC), 550 / 550 Turbo / 5XL (NFC-locked) — see hardware list |
| Peers | `@thermal-label/contracts`, `@thermal-label/transport`, `@mbtech-nl/bitmap` |
| License | MIT |

Not affiliated with DYMO. Trademarks belong to their owners.

## Contributing

See [`CONTRIBUTING/`](https://github.com/thermal-label/.github/tree/main/CONTRIBUTING)
on the org `.github` repo.
