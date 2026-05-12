[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / RotateDirection

# Type Alias: RotateDirection

> **RotateDirection** = `90` \| `270`

Direction the printer family rotates landscape input.

`90` = clockwise, `270` = counter-clockwise. Each driver picks the
value that matches its head/leading-edge geometry — confirm once on
hardware with a die-cut "F" landscape print, then export the constant
from the driver core.
