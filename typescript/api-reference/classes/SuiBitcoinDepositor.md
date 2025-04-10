# Class: SuiBitcoinDepositor

SUI implementation of BitcoinDepositor.

This class handles the initialization of Bitcoin deposits on the SUI blockchain.
It communicates with the `l2_tbtc::BitcoinDepositor` Move module defined in `bitcoin_depositor.move`.

## Parameter Mapping (TypeScript → Move)

When `initializeDeposit` is called, the TypeScript parameters are transformed as follows:

- `fundingTx` (BitcoinRawTxVectors): Serialized as concatenated byte vectors:
  ```
  [version bytes][inputs bytes][outputs bytes][locktime bytes]
  ```
  This becomes the `funding_tx: vector<u8>` parameter in Move.

- `depositReceipt.extraData` (Hex): Used directly as the `deposit_owner: vector<u8>` 
  parameter in Move. This stores the SUI address of the deposit owner (32 bytes).

- Deposit reveal data: Constructed from `depositReceipt` fields (walletPublicKeyHash,
  refundPublicKeyHash, etc.) and sent as the `deposit_reveal: vector<u8>` parameter in Move.

The SUI deposit is considered successful when the Move function emits a `DepositInitialized` event.

## Implements

- [`BitcoinDepositor`](../interfaces/BitcoinDepositor.md)

## Table of contents

### Constructors

- [constructor](SuiBitcoinDepositor.md#constructor)

### Properties

- [#contractAddress](SuiBitcoinDepositor.md##contractaddress)
- [#depositOwner](SuiBitcoinDepositor.md##depositowner)
- [#extraDataEncoder](SuiBitcoinDepositor.md##extradataencoder)
- [#signer](SuiBitcoinDepositor.md##signer)
- [#suiClient](SuiBitcoinDepositor.md##suiclient)

### Methods

- [extraDataEncoder](SuiBitcoinDepositor.md#extradataencoder)
- [getChainIdentifier](SuiBitcoinDepositor.md#getchainidentifier)
- [getDepositOwner](SuiBitcoinDepositor.md#getdepositowner)
- [initializeDeposit](SuiBitcoinDepositor.md#initializedeposit)
- [setDepositOwner](SuiBitcoinDepositor.md#setdepositowner)

## Constructors

### constructor

• **new SuiBitcoinDepositor**(`suiClient`, `contractAddress`, `signer`): [`SuiBitcoinDepositor`](SuiBitcoinDepositor.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `suiClient` | `SuiClient` |
| `contractAddress` | `string` |
| `signer` | `Signer` |

#### Returns

[`SuiBitcoinDepositor`](SuiBitcoinDepositor.md)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:48](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L48)

## Properties

### #contractAddress

• `Private` `Readonly` **#contractAddress**: [`SuiAddress`](SuiAddress.md)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:43](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L43)

___

### #depositOwner

• `Private` **#depositOwner**: `undefined` \| [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:46](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L46)

___

### #extraDataEncoder

• `Private` `Readonly` **#extraDataEncoder**: [`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:44](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L44)

___

### #signer

• `Private` `Readonly` **#signer**: `Signer`

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:45](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L45)

___

### #suiClient

• `Private` `Readonly` **#suiClient**: `SuiClient`

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:42](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L42)

## Methods

### extraDataEncoder

▸ **extraDataEncoder**(): [`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

#### Returns

[`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

Extra data encoder for this contract. The encoder is used to
encode and decode the extra data included in the cross-chain deposit script.

#### Implementation of

[BitcoinDepositor](../interfaces/BitcoinDepositor.md).[extraDataEncoder](../interfaces/BitcoinDepositor.md#extradataencoder)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:71](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L71)

___

### getChainIdentifier

▸ **getChainIdentifier**(): [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Gets the chain-specific identifier of this contract.

#### Returns

[`ChainIdentifier`](../interfaces/ChainIdentifier.md)

#### Implementation of

[BitcoinDepositor](../interfaces/BitcoinDepositor.md).[getChainIdentifier](../interfaces/BitcoinDepositor.md#getchainidentifier)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:56](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L56)

___

### getDepositOwner

▸ **getDepositOwner**(): `undefined` \| [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Gets the identifier that should be used as the owner of the deposits
issued by this contract.

#### Returns

`undefined` \| [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

The identifier of the deposit owner or undefined if not set.

#### Implementation of

[BitcoinDepositor](../interfaces/BitcoinDepositor.md).[getDepositOwner](../interfaces/BitcoinDepositor.md#getdepositowner)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:60](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L60)

___

### initializeDeposit

▸ **initializeDeposit**(`depositTx`, `depositOutputIndex`, `deposit`, `vault?`): `Promise`\<[`Hex`](Hex.md)\>

Initializes the cross-chain deposit indirectly through the given L2 chain.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `depositTx` | [`BitcoinRawTxVectors`](../interfaces/BitcoinRawTxVectors.md) | Deposit transaction data |
| `depositOutputIndex` | `number` | Index of the deposit transaction output that funds the revealed deposit |
| `deposit` | [`DepositReceipt`](../interfaces/DepositReceipt.md) | Data of the revealed deposit |
| `vault?` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) | Optional parameter denoting the vault the given deposit should be routed to |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

Transaction hash of the reveal deposit transaction.

#### Implementation of

[BitcoinDepositor](../interfaces/BitcoinDepositor.md).[initializeDeposit](../interfaces/BitcoinDepositor.md#initializedeposit)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:75](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L75)

___

### setDepositOwner

▸ **setDepositOwner**(`depositOwner`): `void`

Sets the identifier that should be used as the owner of the deposits
issued by this contract.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `depositOwner` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) | Identifier of the deposit owner or undefined to clear. |

#### Returns

`void`

#### Implementation of

[BitcoinDepositor](../interfaces/BitcoinDepositor.md).[setDepositOwner](../interfaces/BitcoinDepositor.md#setdepositowner)

#### Defined in

[lib/sui/sui-bitcoin-depositor.ts:64](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-bitcoin-depositor.ts#L64)
