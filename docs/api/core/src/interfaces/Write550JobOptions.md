[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / Write550JobOptions

# Interface: Write550JobOptions

## Properties

### handshakeReadTimeoutMs?

> `optional` **handshakeReadTimeoutMs?**: `number`

Per-handshake read deadline, ms. The 550 may take a couple of
seconds to answer the post-`ESC G` `ESC A` while the label is
physically feeding. Omit (or pass `undefined`) to delegate the
deadline to the transport's own policy — the WebUSB transport
has no implicit timeout and an unresponsive firmware would hang
the read forever, so web callers should set a finite value.
