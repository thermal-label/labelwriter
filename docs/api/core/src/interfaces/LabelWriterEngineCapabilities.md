[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / LabelWriterEngineCapabilities

# Interface: LabelWriterEngineCapabilities

Engine-level capability flags specific to the LabelWriter driver.

Lives on `engine.capabilities` via the contracts open index signature.
Promote a key to `PrintEngineCapabilities` in the contracts package
once a second active driver implements compatible semantics.

## Properties

### genuineMediaRequired?

> `optional` **genuineMediaRequired?**: `boolean`

NFC-locked roll authentication: device refuses non-genuine rolls
and silently overrides label-length on genuine rolls. Today only
the LabelWriter 5xx family. See `hardwareQuirks` for the
mismatch-behaviour caveat.
