[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / D1\_STATUS\_REQUEST

# Variable: D1\_STATUS\_REQUEST

> `const` **D1\_STATUS\_REQUEST**: `Uint8Array`

Status request — `ESC A`.

Per LW Tech Ref: returns 8 status bytes. Only byte 0 carries the
status info (the remaining 7 bytes are reserved / firmware-internal
state and vary noisily across reads). LW Duo paper side and
standalone LabelManager chassis share this opcode and the
byte 0 layout.
