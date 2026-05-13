# Verification checklist — DYMO LabelWriter

Hardware verification now runs through the harness app. It walks
through device detection, prints a diagnostic, and submits a
hardware report issue automatically — no manual CLI transcription,
no scattered captures.

## Browser harness

Open <https://thermal-label.github.io/harness/labelwriter/> in a
Chromium-class browser, click **Pair**, select your LabelWriter,
and follow the prompts. Bench-validated.

## CLI harness

For TCP-9100 network models (LabelWriter Wireless, 550 Turbo, 5XL)
and any transport the browser can't reach, run from a checkout of
the harness monorepo:

```bash
pnpm --filter verify-cli verify labelwriter <model-key>
```

## Fallback

Hand-rolled report? Open the
[hardware verification issue template](https://github.com/thermal-label/labelwriter/issues/new?template=hardware_verification.yml)
directly.

## Driver-specific notes for the verifier

- **NFC-locked media (550-series).** The LabelWriter 550 / 550 Turbo
  / 5XL only print with genuine Dymo labels carrying a valid NFC
  tag. If a third-party roll is loaded, the printer will refuse to
  print and `paperOut` reads `true` even though tape is present —
  that is **not** a driver bug. If you have a non-genuine roll on
  hand, the harness offers an optional negative-test step to confirm
  the failure mode surfaces cleanly.
- **450 Twin Turbo dual-roll.** Per-roll selection is exposed via
  `--roll left|right`. If your CLI version lacks `--roll`, flag it
  in the report so the gap surfaces.
