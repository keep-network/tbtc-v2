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

[services/deposits/deposit.ts:165](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L165)

## Properties

### receipt

• `Readonly` **receipt**: [`DepositReceipt`](../interfaces/DepositReceipt.md)

Deposit receipt holding the most important information about the deposit
and allowing to build a unique deposit script (and address) on Bitcoin chain.

#### Defined in

[services/deposits/deposit.ts:158](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L158)

___

### witness

• `Readonly` **witness**: `boolean`

Flag indicating whether the generated Bitcoin deposit script (and address)
should be a witness P2WSH one. If false, legacy P2SH will be used instead.

#### Defined in

[services/deposits/deposit.ts:163](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L163)

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

[services/deposits/deposit.ts:227](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L227)

___

### getHash

▸ **getHash**(): `Promise`\<`Buffer`\>

#### Returns

`Promise`\<`Buffer`\>

Hashed deposit script as Buffer.

#### Defined in

[services/deposits/deposit.ts:182](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L182)

___

### getPlainText

▸ **getPlainText**(): `Promise`\<[`Hex`](Hex.md)\>

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

Plain-text deposit script as a hex string.

#### Defined in

[services/deposits/deposit.ts:194](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L194)

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

[services/deposits/deposit.ts:172](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L172)
