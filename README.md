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
