# CLI

The `labelwriter` CLI provides a terminal interface for all LabelWriter operations.

## Install

```bash
npm install -g @thermal-label/labelwriter-cli
```

## Commands

### `labelwriter list`

Lists all connected USB LabelWriter printers.

```bash
labelwriter list
```

**Output:**
```
Found 1 printer(s):

  LabelWriter 450  [1:2]  SN: AB1234
```

---

### `labelwriter status`

Queries the printer status and reports whether it is ready to print.

```bash
labelwriter status
labelwriter status --host 192.168.1.100
labelwriter status --serial AB1234
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--host <ip>` | Use TCP transport instead of USB |
| `--serial <sn>` | Target a specific printer by serial number |

---

### `labelwriter print text <text>`

Renders text and prints it as a label.

```bash
labelwriter print text "Hello, world!"
labelwriter print text "Fragile" --density high --copies 3
labelwriter print text "Return" --invert --scale-x 1.5
```

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `--invert` | boolean | Invert black and white |
| `--scale-x <n>` | number | Horizontal scale factor |
| `--scale-y <n>` | number | Vertical scale factor |
| `--density <level>` | `light\|medium\|normal\|high` | Print density |
| `--mode <mode>` | `text\|graphics` | Print mode |
| `--roll <n>` | `0\|1` | Roll select (Twin Turbo only) |
| `--copies <n>` | number | Number of copies |
| `--host <ip>` | string | Use TCP transport |
| `--serial <sn>` | string | Target by serial number |

---

### `labelwriter print image <file>`

Loads an image file and prints it as a label. Requires `@napi-rs/canvas` to be installed.

```bash
labelwriter print image ./barcode.png
labelwriter print image ./logo.png --threshold 128 --rotate 90
```

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `--threshold <n>` | 0–255 | Binarization threshold (default 128) |
| `--dither` | boolean | Apply Floyd-Steinberg dithering |
| `--invert` | boolean | Invert black and white |
| `--rotate <deg>` | `0\|90\|180\|270` | Rotate image before printing |
| `--density <level>` | `light\|medium\|normal\|high` | Print density |
| `--mode <mode>` | `text\|graphics` | Print mode |
| `--copies <n>` | number | Number of copies |
| `--host <ip>` | string | Use TCP transport |
| `--serial <sn>` | string | Target by serial number |

---

### `labelwriter recover`

Sends the error recovery sequence to the printer, then reads and reports status. Use this when the printer is stuck after a fault.

```bash
labelwriter recover
labelwriter recover --host 192.168.1.100
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--host <ip>` | Use TCP transport |
| `--serial <sn>` | Target by serial number |
