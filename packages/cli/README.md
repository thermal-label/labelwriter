# @thermal-label/labelwriter-cli

CLI for Dymo LabelWriter printers.

## Install

```bash
npm install -g @thermal-label/labelwriter-cli
```

## Commands

```
labelwriter list                          List connected USB printers
labelwriter status [--host <ip>]          Query printer status
labelwriter print text <text> [options]   Print text label
labelwriter print image <file> [options]  Print image label
labelwriter recover                       Send error recovery sequence
```

## `print text` options

| Flag | Description |
|------|-------------|
| `--invert` | Invert black/white |
| `--scale-x <n>` | Horizontal scale factor |
| `--scale-y <n>` | Vertical scale factor |
| `--density light\|medium\|normal\|high` | Print density |
| `--mode text\|graphics` | Print mode |
| `--roll 0\|1` | Roll select (Twin Turbo only) |
| `--copies <n>` | Number of copies |
| `--host <ip>` | TCP transport (overrides USB) |
| `--serial <sn>` | Target printer by serial number |

## `print image` options

| Flag | Description |
|------|-------------|
| `--threshold <0-255>` | Binarization threshold |
| `--dither` | Apply dithering |
| `--invert` | Invert black/white |
| `--rotate <0\|90\|180\|270>` | Rotate image |
| `--density light\|medium\|normal\|high` | Print density |
| `--mode text\|graphics` | Print mode |
| `--copies <n>` | Number of copies |
| `--host <ip>` | TCP transport |
| `--serial <sn>` | Target printer by serial number |

## NFC label lock (550 series)

The LabelWriter 550 series enforces NFC chip validation on Dymo-branded labels at the hardware level. This cannot be bypassed in software. Use compatible labels to avoid paper-out errors.

## License

MIT © Mannes Brak
