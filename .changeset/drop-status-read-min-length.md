---
'@thermal-label/labelwriter-web': patch
---

Drop the `STATUS_READ_MIN_LENGTH` bulk-IN read workaround.

Chromium's WebUSB could stall a `transferIn` request smaller than the
endpoint's `wMaxPacketSize`. The web driver worked around this by padding
status reads up to a hard-coded 16 bytes — but that covered only
`getStatus()` and guessed the packet size.

The fix now lives in `@thermal-label/transport`'s `WebUsbTransport.read()`,
which rounds every read up to the IN endpoint's real `wMaxPacketSize`.
`getStatus()` requests the exact status byte count again, and the
`STATUS_READ_TIMEOUT_MS` deadline is now also applied to the 550's
`acquire550Lock()` and `getMedia()` pre-print reads — a non-responsive
device throws a timeout instead of hanging silently.
