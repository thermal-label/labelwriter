---
layout: home

hero:
  name: '@thermal-label/labelwriter'
  text: TypeScript driver for Dymo LabelWriter
  tagline: No vendor software. No proprietary drivers. Just USB, TCP, and WebUSB — from Node.js or the browser.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: brand
      text: Try it now →
      link: /demo
    - theme: alt
      text: GitHub
      link: https://github.com/thermal-label/labelwriter

features:
  - icon: 🟢
    title: Node.js
    details: Direct USB bulk-transfer printing from Node.js servers and desktop apps. TCP for network-attached 550 Turbo / 5XL / Wireless. Zero native dependencies beyond the usb package.
    link: /node
    linkText: Node.js guide
  - icon: 🌐
    title: Browser
    details: WebUSB printing directly from Chrome or Edge — no server, no install, no driver swap required.
    link: /web
    linkText: Web guide
  - icon: 🔌
    title: PrinterAdapter
    details: The node and web packages share the PrinterAdapter interface. Swap between USB, TCP, and WebUSB transports without changing call sites.
    link: /core
    linkText: Core & protocol
---

<div class="home-extra">

<div class="ref-links">
  <a href="./hardware.html" class="ref-link">
    <span class="ref-icon">🖨️</span>
    <span class="ref-body">
      <strong>Supported hardware</strong>
      <span>Device list, USB PIDs, protocol variants, NFC lock</span>
    </span>
    <span class="ref-arrow">→</span>
  </a>
  <a href="./protocol/" class="ref-link">
    <span class="ref-icon">📡</span>
    <span class="ref-body">
      <strong>Wire protocols</strong>
      <span>LW 450 raster · LW 550 NFC · Duo tape — byte-level reference</span>
    </span>
    <span class="ref-arrow">→</span>
  </a>
  <a href="./core.html" class="ref-link">
    <span class="ref-icon">🧰</span>
    <span class="ref-body">
      <strong>Core API</strong>
      <span>Encoder, parsers, types, registries</span>
    </span>
    <span class="ref-arrow">→</span>
  </a>
</div>

::: warning 550 series NFC label lock
The LabelWriter 550, 550 Turbo, and 5XL enforce NFC chip validation on every print job. **Non-certified labels are rejected at the hardware level** — there is no software workaround. See [Hardware](./hardware#nfc-label-lock-550-series) for the full model list.
:::

<div class="ecosystem">
  <p class="ecosystem-label">Also in this ecosystem</p>
  <div class="ecosystem-links">
    <a href="https://thermal-label.github.io/labelmanager/" class="ecosystem-link" target="_blank" rel="noopener">
      <span class="eco-name">labelmanager</span>
      <span class="eco-desc">DYMO LabelManager D1 tape printers</span>
    </a>
    <a href="https://thermal-label.github.io/brother-ql/" class="ecosystem-link" target="_blank" rel="noopener">
      <span class="eco-name">brother-ql</span>
      <span class="eco-desc">Brother QL label printers</span>
    </a>
  </div>
</div>

</div>
