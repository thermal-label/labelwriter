[**labelwriter**](../../../README.md)

---

[labelwriter](../../../README.md) / [node/src](../README.md) / UsbTransport

# Class: UsbTransport

Defined in: node/src/transport.ts:26

## Implements

- [`Transport`](../interfaces/Transport.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: node/src/transport.ts:61

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Transport`](../interfaces/Transport.md).[`close`](../interfaces/Transport.md#close)

---

### read()

> **read**(`byteCount`): `Promise`\<`Uint8Array`\>

Defined in: node/src/transport.ts:56

#### Parameters

##### byteCount

`number`

#### Returns

`Promise`\<`Uint8Array`\>

#### Implementation of

[`Transport`](../interfaces/Transport.md).[`read`](../interfaces/Transport.md#read)

---

### write()

> **write**(`data`): `Promise`\<`void`\>

Defined in: node/src/transport.ts:52

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Transport`](../interfaces/Transport.md).[`write`](../interfaces/Transport.md#write)

---

### open()

> `static` **open**(`vid`, `pid`): `UsbTransport`

Defined in: node/src/transport.ts:34

#### Parameters

##### vid

`number`

##### pid

`number`

#### Returns

`UsbTransport`
