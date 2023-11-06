# Class: Deposit

Component representing an instance of the tBTC v2 deposit process.
Depositing is a complex process spanning both the Bitcoin and the target chain.
This component tries to abstract away that complexity.

## Table of contents

### Constructors

- [constructor](Deposit.md#constructor)

### Properties

- [bitcoinClient](Deposit.md#bitcoinclient)
- [bitcoinNetwork](Deposit.md#bitcoinnetwork)
- [script](Deposit.md#script)
- [tbtcContracts](Deposit.md#tbtccontracts)

### Methods

- [detectFunding](Deposit.md#detectfunding)
- [getBitcoinAddress](Deposit.md#getbitcoinaddress)
- [getReceipt](Deposit.md#getreceipt)
- [initiateMinting](Deposit.md#initiateminting)
- [fromReceipt](Deposit.md#fromreceipt)

## Constructors

### constructor

• **new Deposit**(`receipt`, `tbtcContracts`, `bitcoinClient`, `bitcoinNetwork`): [`Deposit`](Deposit.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `receipt` | [`DepositReceipt`](../interfaces/DepositReceipt.md) |
| `tbtcContracts` | [`TBTCContracts`](../README.md#tbtccontracts) |
| `bitcoinClient` | [`BitcoinClient`](../interfaces/BitcoinClient.md) |
| `bitcoinNetwork` | [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md) |

#### Returns

[`Deposit`](Deposit.md)

#### Defined in

[services/deposits/deposit.ts:42](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L42)

## Properties

### bitcoinClient

• `Private` `Readonly` **bitcoinClient**: [`BitcoinClient`](../interfaces/BitcoinClient.md)

Bitcoin client handle.

#### Defined in

[services/deposits/deposit.ts:35](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L35)

___

### bitcoinNetwork

• `Readonly` **bitcoinNetwork**: [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md)

Bitcoin network the deposit is relevant for. Has an impact on the
generated deposit address.

#### Defined in

[services/deposits/deposit.ts:40](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L40)

___

### script

• `Private` `Readonly` **script**: [`DepositScript`](DepositScript.md)

Bitcoin script corresponding to this deposit.

#### Defined in

[services/deposits/deposit.ts:27](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L27)

___

### tbtcContracts

• `Private` `Readonly` **tbtcContracts**: [`TBTCContracts`](../README.md#tbtccontracts)

Handle to tBTC contracts.

#### Defined in

[services/deposits/deposit.ts:31](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L31)

## Methods

### detectFunding

▸ **detectFunding**(): `Promise`\<[`BitcoinUtxo`](../README.md#bitcoinutxo)[]\>

Detects Bitcoin funding transactions transferring BTC to this deposit.

#### Returns

`Promise`\<[`BitcoinUtxo`](../README.md#bitcoinutxo)[]\>

Specific UTXOs targeting this deposit. Empty array in case
        there are no UTXOs referring this deposit.

#### Defined in

[services/deposits/deposit.ts:84](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L84)

___

### getBitcoinAddress

▸ **getBitcoinAddress**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

Bitcoin address corresponding to this deposit.

#### Defined in

[services/deposits/deposit.ts:74](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L74)

___

### getReceipt

▸ **getReceipt**(): [`DepositReceipt`](../interfaces/DepositReceipt.md)

#### Returns

[`DepositReceipt`](../interfaces/DepositReceipt.md)

Receipt corresponding to this deposit.

#### Defined in

[services/deposits/deposit.ts:67](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L67)

___

### initiateMinting

▸ **initiateMinting**(`fundingOutpoint?`): `Promise`\<[`Hex`](Hex.md)\>

Initiates minting of the TBTC token, based on the Bitcoin funding
transaction outpoint targeting this deposit. By default, it detects and
uses the outpoint of the recent Bitcoin funding transaction and throws if
such a transaction does not exist. This behavior can be changed by pointing
a funding transaction explicitly, using the fundingOutpoint parameter.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `fundingOutpoint?` | [`BitcoinTxOutpoint`](../interfaces/BitcoinTxOutpoint.md) | Optional parameter. Can be used to point the funding transaction's outpoint manually. |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

Target chain hash of the initiate minting transaction.

**`Throws`**

Throws an error if there are no funding transactions while using
        the default funding detection mode.

**`Throws`**

Throws an error if the provided funding outpoint does not
        actually refer to this deposit while using the manual funding
        provision mode.

**`Throws`**

Throws an error if the funding outpoint was already used to
        initiate minting (both modes).

#### Defined in

[services/deposits/deposit.ts:114](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L114)

___

### fromReceipt

▸ **fromReceipt**(`receipt`, `tbtcContracts`, `bitcoinClient`): `Promise`\<[`Deposit`](Deposit.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `receipt` | [`DepositReceipt`](../interfaces/DepositReceipt.md) |
| `tbtcContracts` | [`TBTCContracts`](../README.md#tbtccontracts) |
| `bitcoinClient` | [`BitcoinClient`](../interfaces/BitcoinClient.md) |

#### Returns

`Promise`\<[`Deposit`](Deposit.md)\>

#### Defined in

[services/deposits/deposit.ts:54](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposit.ts#L54)