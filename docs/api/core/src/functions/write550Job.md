[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / write550Job

# Function: write550Job()

> **write550Job**(`transport`, `job`, `options?`): `Promise`\<`void`\>

Write a composed 550 job interactively over the given transport.

The 550 firmware stops draining the bulk-OUT endpoint after each
label's `ESC G` footer until the host issues `ESC A` and reads the
32-byte status reply (confirmed against minlux/dymon's Wireshark
capture + the LW 550 Technical Reference). So: write the preamble,
then per label write the segment + `ESC A`, drain the handshake
status, then write `ESC E` + `ESC Q`.

`ESC A` lock byte per the 550 spec: `0` for the LAST label — the
final status query, which also drops the host lock; `2` between
labels — the host does not block on that reply before streaming
the next label, so the read is deferred to the next iteration.

Pure protocol orchestration — no driver state is touched; both the
node and web `LabelWriterPrinter`s dispatch through here so a bug
fix lands in one place.

## Parameters

### transport

[`Transport`](/contracts/api/interfaces/Transport)

### job

[`Composed550Job`](../interfaces/Composed550Job.md)

### options?

[`Write550JobOptions`](../interfaces/Write550JobOptions.md) = `{}`

## Returns

`Promise`\<`void`\>
