---
layout: home

hero:
  name: labelwriter
  text: TypeScript driver for Dymo LabelWriter
  tagline: USB, TCP, and WebUSB support for Node.js, CLI, and the browser.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/thermal-label/labelwriter

features:
  - icon: 🖨
    title: Full protocol coverage
    details: Supports all LabelWriter models from the 400 to the 5XL — both the 450-series and the 550-series protocol, including job headers and error recovery.
  - icon: 🌐
    title: WebUSB in the browser
    details: Print directly from Chrome and Edge using the WebUSB API — no drivers, no backend, no plugins needed.
  - icon: 🖥
    title: Node.js USB and TCP
    details: Connect over USB bulk transfer or TCP (Wireless models) with the same high-level API.
  - icon: ⌨
    title: CLI included
    details: The labelwriter CLI lets you print text and images, check status, and recover from errors — all from the terminal.
---

## Ecosystem

| Package | Environment | Description |
|---------|-------------|-------------|
| [`@thermal-label/labelwriter-core`](/core) | Universal | Protocol encoder, device registry, bitmap utilities |
| [`@thermal-label/labelwriter-node`](/node) | Node.js | USB and TCP transport, `LabelWriterPrinter` |
| [`@thermal-label/labelwriter-cli`](/cli) | Terminal | `labelwriter` command |
| [`@thermal-label/labelwriter-web`](/web) | Browser | WebUSB printer driver |

## 550 series NFC label lock

::: warning 550 series requires genuine Dymo labels
The LabelWriter 550, 550 Turbo, 5XL, and related models enforce NFC chip validation on every print job. The hardware reads the NFC chip embedded in Dymo-branded label rolls. **Non-certified labels are rejected at the hardware level** — you will see a paper-out error regardless of which software you use. This behaviour cannot be bypassed in software, including by this library.

See [Hardware](/hardware) for a full model list and [Getting started](/getting-started#nfc-label-lock) for guidance.
:::
