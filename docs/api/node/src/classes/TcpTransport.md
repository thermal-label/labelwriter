[**labelwriter**](../../../README.md)

---

[labelwriter](../../../README.md) / [node/src](../README.md) / TcpTransport

# Class: TcpTransport

Defined in: node/src/transport.ts:67

## Implements

- [`Transport`](../interfaces/Transport.md)

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: node/src/transport.ts:113

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Transport`](../interfaces/Transport.md).[`close`](../interfaces/Transport.md#close)

---

### read()

> **read**(`byteCount`): `Promise`\<`Uint8Array`\>

Defined in: node/src/transport.ts:88

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

Defined in: node/src/transport.ts:79

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`Transport`](../interfaces/Transport.md).[`write`](../interfaces/Transport.md#write)

---

### connect()

> `static` **connect**(`host`, `port?`): `Promise`\<`TcpTransport`\>

Defined in: node/src/transport.ts:70

#### Parameters

##### host

`string`

##### port?

`number` = `9100`

#### Returns

`Promise`\<`TcpTransport`\>
