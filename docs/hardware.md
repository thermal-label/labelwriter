# Hardware

## Supported devices

| Model                      | PID      | Protocol | Head dots | Network  | NFC lock | Status      |
| -------------------------- | -------- | -------- | --------- | -------- | -------- | ----------- |
| LabelWriter 400            | `0x0019` | 450      | 672       | —        | No       | ✅ Verified |
| LabelWriter 400 Turbo      | `0x0023` | 450      | 672       | —        | No       | 🔲 Expected |
| LabelWriter 450            | `0x0020` | 450      | 672       | —        | No       | ✅ Verified |
| LabelWriter 450 Turbo      | `0x002A` | 450      | 672       | —        | No       | 🔲 Expected |
| LabelWriter 450 Twin Turbo | `0x002B` | 450      | 672       | —        | No       | 🔲 Expected |
| LabelWriter 450 Duo        | `0x002C` | 450      | 672       | —        | No       | 🔲 Expected |
| LabelWriter 4XL            | `0x0025` | 450      | 672       | —        | No       | 🔲 Expected |
| LabelWriter Wireless       | `0x0031` | 450      | 672       | Wi-Fi    | No       | 🔲 Expected |
| LabelWriter 550            | `0x0052` | 550      | 672       | —        | **Yes**  | 🔲 Expected |
| LabelWriter 550 Turbo      | `0x0053` | 550      | 672       | Ethernet | **Yes**  | 🔲 Expected |
| LabelWriter 5XL            | `0x0054` | 550      | 1248      | Ethernet | **Yes**  | 🔲 Expected |

All devices use vendor ID `0x0922` (Dymo).

<div class="hw-cta">
  <div class="hw-cta-header">
    <span class="hw-cta-icon">🔌</span>
    <div class="hw-cta-text">
      <strong>Got one of the untested devices?</strong>
      <span>A two-minute test helps everyone who owns one of these printers.</span>
    </div>
  </div>
  <div class="hw-cta-steps">
    <span>Run these two commands and report what happens:</span>
    <div class="hw-cta-cmds">
      <code>labelwriter list</code>
      <span class="hw-cta-arrow">→</span>
      <code>labelwriter print text "test"</code>
    </div>
  </div>
  <div class="hw-cta-actions">
    <a class="hw-chip hw-chip-works" href="https://github.com/thermal-label/labelwriter/issues/new?template=hardware_verification.yml&title=Verified%3A+%5BDevice+name%5D&labels=hardware%2Cverified" target="_blank" rel="noopener">✅ It works</a>
    <a class="hw-chip hw-chip-partial" href="https://github.com/thermal-label/labelwriter/issues/new?template=hardware_verification.yml&title=Partial%3A+%5BDevice+name%5D&labels=hardware%2Cpartial" target="_blank" rel="noopener">⚠️ Partially works</a>
    <a class="hw-chip hw-chip-broken" href="https://github.com/thermal-label/labelwriter/issues/new?template=hardware_verification.yml&title=Broken%3A+%5BDevice+name%5D&labels=hardware%2Cbroken" target="_blank" rel="noopener">❌ Doesn't work</a>
  </div>
</div>

## 450 vs 550 protocol

### 450-series protocol

The 450-series protocol is the original Dymo LabelWriter protocol:

- **Reset:** `ESC @`
- **Raster line (uncompressed):** `0x16 <len> <data…>`
- **Raster line (RLE):** `0x17 <len> <pairs…>`
- **Form feed:** `ESC E`
- **Short form feed:** `ESC m`
- **Status request:** `ESC A`
- **Error recovery:** 85 × `ESC` followed by `ESC A`

### 550-series protocol

The 550-series protocol extends 450 with a mandatory job header prepended before every reset:

- **Job header:** `ESC s <jobId[4]>` where `jobId` is a 4-byte little-endian job identifier
- All other commands are the same as 450-series

The job header is required for every print job on 550-series devices. Sending a print without it results in a protocol error.

## NFC label lock (550 series)

All 550-series devices (LabelWriter 550, 550 Turbo, 5XL) include an NFC reader that validates label roll authenticity before printing:

1. When a print job begins, the printer reads the NFC chip embedded in the label roll spool.
2. If no chip is detected, or the chip is not a recognised Dymo-certified label, the printer raises a paper-out condition.
3. The printer's status byte reflects this as `paperOut = true`.
4. The host software has no way to disable or bypass this check — it is handled entirely within the printer firmware.

To print successfully with a 550-series device, you must use genuine Dymo-branded label rolls that include an NFC chip.

## Print head geometry

All models except the 5XL have a print head 672 dots wide (84 bytes per raster row). The LabelWriter 5XL has a 1248-dot head (156 bytes per row).

Label length in dots determines the number of raster rows in the print job. The `setLabelLength` command (`ESC L <len_lo> <len_hi>`) specifies this in a 16-bit little-endian value.
