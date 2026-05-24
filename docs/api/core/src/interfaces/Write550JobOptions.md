[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / Write550JobOptions

# Interface: Write550JobOptions

## Properties

### handshakeReadTimeoutMs?

> `optional` **handshakeReadTimeoutMs?**: `number`

Per-handshake read deadline, ms. Omit to delegate to the
transport's own policy — WebUSB has no implicit timeout, so web
callers should set a finite value.
