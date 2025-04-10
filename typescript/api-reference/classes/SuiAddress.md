# Class: SuiAddress

Represents a SUI address.

**`See`**

for reference.

## Implements

- [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

## Table of contents

### Constructors

- [constructor](SuiAddress.md#constructor)

### Properties

- [\_internalHex](SuiAddress.md#_internalhex)
- [identifierHex](SuiAddress.md#identifierhex)
- [type](SuiAddress.md#type)

### Methods

- [equals](SuiAddress.md#equals)
- [toHex](SuiAddress.md#tohex)
- [toString](SuiAddress.md#tostring)
- [from](SuiAddress.md#from)

## Constructors

### constructor

• **new SuiAddress**(`hex`): [`SuiAddress`](SuiAddress.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `hex` | `string` |

#### Returns

[`SuiAddress`](SuiAddress.md)

#### Defined in

[lib/sui/address.ts:35](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L35)

## Properties

### \_internalHex

• `Private` `Readonly` **\_internalHex**: [`Hex`](Hex.md)

#### Defined in

[lib/sui/address.ts:33](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L33)

___

### identifierHex

• `Readonly` **identifierHex**: `string`

Identifier as an un-prefixed hex string.

#### Implementation of

[ChainIdentifier](../interfaces/ChainIdentifier.md).[identifierHex](../interfaces/ChainIdentifier.md#identifierhex)

#### Defined in

[lib/sui/address.ts:30](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L30)

___

### type

• `Readonly` **type**: ``"sui"``

#### Defined in

[lib/sui/address.ts:28](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L28)

## Methods

### equals

▸ **equals**(`other`): `boolean`

Checks if two ChainIdentifiers are equal.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `other` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) | The other ChainIdentifier instance to compare. |

#### Returns

`boolean`

True if the identifiers are equal, false otherwise.

#### Implementation of

[ChainIdentifier](../interfaces/ChainIdentifier.md).[equals](../interfaces/ChainIdentifier.md#equals)

#### Defined in

[lib/sui/address.ts:88](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L88)

___

### toHex

▸ **toHex**(): [`Hex`](Hex.md)

Returns the underlying Hex object.

#### Returns

[`Hex`](Hex.md)

#### Defined in

[lib/sui/address.ts:109](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L109)

___

### toString

▸ **toString**(): `string`

Returns the hex string representation of the address.

#### Returns

`string`

The hex string (e.g., "0x...").

#### Defined in

[lib/sui/address.ts:101](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L101)

___

### from

▸ **from**(`hex`): [`SuiAddress`](SuiAddress.md)

Creates a SuiAddress instance from a hex string.
Validates if the input string is a valid SUI address.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `hex` | `string` | The hex string representation of the SUI address (e.g., "0x..."). |

#### Returns

[`SuiAddress`](SuiAddress.md)

A new SuiAddress instance.

**`Throws`**

Error if the hex string is not a valid SUI address.

#### Defined in

[lib/sui/address.ts:47](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/address.ts#L47)
