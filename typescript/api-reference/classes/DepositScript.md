# Class: DepositScript

Represents a Bitcoin script corresponding to a tBTC v2 deposit.
On a high-level, the script is used to derive the Bitcoin address that is
used to fund the deposit with BTC. On a low-level, the script is used to
produce a properly locked funding transaction output that can be unlocked
by the target wallet during the deposit sweep process.

## Table of contents

### Constructors

- [constructor](DepositScript.md#constructor)

### Properties

- [receipt](DepositScript.md#receipt)
- [witness](DepositScript.md#witness)

### Methods

- [deriveAddress](DepositScript.md#deriveaddress)
- [getHash](DepositScript.md#gethash)
- [getPlainText](DepositScript.md#getplaintext)
- [fromReceipt](DepositScript.md#fromreceipt)

## Constructors

### constructor

• **new DepositScript**(`receipt`, `witness`): [`DepositScript`](DepositScript.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `receipt` | [`DepositReceipt`](../interfaces/DepositReceipt.md) |
| `witness` | `boolean` |

#### Returns

[`DepositScript`](DepositScript.md)

#### Defined in

[services/deposits/deposit.ts:164](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L164)

## Properties

### receipt

• `Readonly` **receipt**: [`DepositReceipt`](../interfaces/DepositReceipt.md)

Deposit receipt holding the most important information about the deposit
and allowing to build a unique deposit script (and address) on Bitcoin chain.

#### Defined in

[services/deposits/deposit.ts:157](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L157)

___

### witness

• `Readonly` **witness**: `boolean`

Flag indicating whether the generated Bitcoin deposit script (and address)
should be a witness P2WSH one. If false, legacy P2SH will be used instead.

#### Defined in

[services/deposits/deposit.ts:162](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L162)

## Methods

### deriveAddress

▸ **deriveAddress**(`bitcoinNetwork`): `Promise`\<`string`\>

Derives a Bitcoin address for the given network for this deposit script.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinNetwork` | [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md) | Bitcoin network the address should be derived for. |

#### Returns

`Promise`\<`string`\>

Bitcoin address corresponding to this deposit script.

#### Defined in

[services/deposits/deposit.ts:226](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L226)

___

### getHash

▸ **getHash**(): `Promise`\<`Buffer`\>

#### Returns

`Promise`\<`Buffer`\>

Hashed deposit script as Buffer.

#### Defined in

[services/deposits/deposit.ts:181](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L181)

___

### getPlainText

▸ **getPlainText**(): `Promise`\<[`Hex`](Hex.md)\>

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

Plain-text deposit script as a hex string.

#### Defined in

[services/deposits/deposit.ts:193](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L193)

___

### fromReceipt

▸ **fromReceipt**(`receipt`, `witness?`): [`DepositScript`](DepositScript.md)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `receipt` | [`DepositReceipt`](../interfaces/DepositReceipt.md) | `undefined` |
| `witness` | `boolean` | `true` |

#### Returns

[`DepositScript`](DepositScript.md)

#### Defined in

[services/deposits/deposit.ts:171](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L171)
