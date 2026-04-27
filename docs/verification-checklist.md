# Verification checklist — DYMO LabelWriter

This is the family-specific checklist. Follow [the verification
guide](https://github.com/thermal-label/.github/blob/main/CONTRIBUTING/verifying-hardware.md)
for context — that doc explains _why_ and _what to do with the
output_.

Capture the terminal output and a photo of the printed label, then
file your report on the
[Hardware verification issue template](https://github.com/thermal-label/labelwriter/issues/new?template=hardware_verification.yml).

> **NFC-locked media (550-series):** the LabelWriter 550 / 550 Turbo
> / 5XL only print with genuine Dymo labels carrying a valid NFC tag.
> If you've loaded a third-party roll, the printer will refuse to
> print — that is **not** a driver bug.

## Setup

```bash
npm install -g thermal-label-cli @thermal-label/labelwriter-node
```

Linux only — a generic udev rule for VID `0x0922`:
`SUBSYSTEMS=="usb", ATTR{idVendor}=="0922", MODE="0666"`.

## 1. Device is detected

```bash
thermal-label list
```

**Expected:** your printer appears with the correct model name and
PID, e.g. `LabelWriter 450 (0x0020) — usb`.

## 2. Status is readable

```bash
thermal-label status
```

**Expected:** `ready: true`, `mediaLoaded: true`, `errors: []`. On
550-series models, `paperOut` is `false` only when a recognised NFC
roll is loaded.

## 3. Print a text label

```bash
thermal-label print text "verify $(date +%Y-%m-%d)"
```

**Expected:** a sharp address-label-sized print with the current
date. The label is cut (or torn at the perforation, depending on
model).

## 4. Print an image

```bash
thermal-label print image small.png
```

**Expected:** a graphics print with no banding. The 4XL and 5XL have
wider heads (101 mm) — verify your image renders to the full width
when sized for it.

## 5. (LabelWriter Wireless / 550 Turbo / 5XL) Print over network

These models support TCP. Find the printer's IP from the LCD or
your router.

```bash
thermal-label list --host 192.0.2.42
thermal-label status --host 192.0.2.42
thermal-label print text "tcp test" --host 192.0.2.42
```

**Expected:** equivalent results to the USB run.

## 6. (LabelWriter 450 Twin Turbo) Roll select

The 450 Twin Turbo has two rolls. The driver exposes per-roll
selection — confirm both rolls print:

```bash
thermal-label print text "left" --roll left
thermal-label print text "right" --roll right
```

(If `--roll` isn't available in your CLI version, mention that in
the report; we'll surface the gap.)

**Expected:** the label prints on whichever roll was specified.

## 7. (550-series) NFC lock — negative test

If you've got a non-genuine roll handy, load it and try to print.
This is a **negative** test: we want to confirm the driver surfaces
the NFC failure cleanly.

```bash
# With a non-genuine roll loaded:
thermal-label status
# Expected: status reflects paperOut=true even though tape is loaded.
thermal-label print text "should fail"
# Expected: a clear error from the printer about media; no silent
# success.
```

**Skip this step** if you only have genuine rolls — that's the
common case and not a problem.

## 8. (Browser) WebUSB live demo

Open [https://thermal-label.github.io/demo/labelwriter](https://thermal-label.github.io/demo/labelwriter)
in a Chromium-class browser, click Pair, select your printer, and
print the demo label.

**Expected:** the same label content as step 3.

## What to capture for the report

- The full terminal output of steps 1–4 (and 5–8 if applicable).
- A clear photo of one printed label.
- The exact `@thermal-label/labelwriter-node` version printed by
  `thermal-label --version`.
- Your OS and Node version.
- For 550-series: whether the NFC negative test was run, and whether
  the failure mode was clean.
