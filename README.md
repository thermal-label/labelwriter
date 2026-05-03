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
