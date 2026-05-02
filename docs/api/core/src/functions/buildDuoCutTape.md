[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / buildDuoCutTape

# Function: buildDuoCutTape()

> **buildDuoCutTape**(): `Uint8Array`

`ESC E` — cut tape.

Per PDF page 25 this *must* be sent at the end of every label
— the Duo tape engine has no feed-without-cut command.

## Returns

`Uint8Array`
