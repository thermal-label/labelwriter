[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / buildSelectRoll

# Function: buildSelectRoll()

> **buildSelectRoll**(`byte`): `Uint8Array`

`ESC q <n>` — select roll on the Twin Turbo. Per LW 450 Series Tech
Ref p.16, `n` is one of:
  `0x30` ('0') — automatic selection (firmware picks)
  `0x31` ('1') — first physical roll  (left)
  `0x32` ('2') — second physical roll (right)

Twin Turbo engine entries store `0x31` / `0x32` directly in
`bind.address`, so the encoder hands the byte through unchanged.
`ROLL_BYTE_AUTO` covers the auto case.

## Parameters

### byte

`number`

## Returns

`Uint8Array`
