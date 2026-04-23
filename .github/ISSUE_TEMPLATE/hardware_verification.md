---
name: Hardware Verification
about: Verify that a specific LabelWriter device works with this driver
title: '[HW] Verify <device name>'
labels: hardware-verification
assignees: ''
---

## Device

- **Model:** (e.g. LabelWriter 450 Turbo)
- **USB PID:** (e.g. 0x002A)
- **Serial number:** (optional)
- **OS:** (e.g. Ubuntu 24.04, macOS 14, Windows 11)

## Test Results

Run the integration tests with your printer connected:

```bash
LABELWRITER_INTEGRATION=1 pnpm test
```

Paste the test output here.

## Checklist

- [ ] `pnpm test` passes (unit tests, no hardware required)
- [ ] `LABELWRITER_INTEGRATION=1 pnpm test` passes with the device connected
- [ ] Printed a text label successfully
- [ ] Printed an image label successfully
- [ ] `labelwriter status` reports the device as ready

## Notes

Any additional observations about the device behaviour.
