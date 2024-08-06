# Interface: L1BitcoinDepositor

Interface for communication with the L1BitcoinDepositor on-chain contract
specific to the given L2 chain, deployed on the L1 chain.

## Implemented by

- [`EthereumL1BitcoinDepositor`](../classes/EthereumL1BitcoinDepositor.md)

## Table of contents

### Methods

- [extraDataEncoder](L1BitcoinDepositor.md#extradataencoder)
- [getChainIdentifier](L1BitcoinDepositor.md#getchainidentifier)
- [initializeDeposit](L1BitcoinDepositor.md#initializedeposit)

## Methods

### extraDataEncoder

▸ **extraDataEncoder**(): [`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

#### Returns

[`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

Extra data encoder for this contract. The encoder is used to
encode and decode the extra data included in the cross-chain deposit script.

#### Defined in

[lib/contracts/cross-chain.ts:126](https://github.com/Unknown-Gravity/tbtc-v2-sdk/blob/main/typescript/src/lib/contracts/cross-chain.ts#L126)

___

### getChainIdentifier

▸ **getChainIdentifier**(): [`ChainIdentifier`](ChainIdentifier.md)

Gets the chain-specific identifier of this contract.

#### Returns

[`ChainIdentifier`](ChainIdentifier.md)

#### Defined in

[lib/contracts/cross-chain.ts:120](https://github.com/Unknown-Gravity/tbtc-v2-sdk/blob/main/typescript/src/lib/contracts/cross-chain.ts#L120)

___

### initializeDeposit

▸ **initializeDeposit**(`depositTx`, `depositOutputIndex`, `deposit`, `vault?`): `Promise`\<[`Hex`](../classes/Hex.md)\>

Initializes the cross-chain deposit directly on the given L1 chain.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `depositTx` | [`BitcoinRawTxVectors`](BitcoinRawTxVectors.md) | Deposit transaction data |
| `depositOutputIndex` | `number` | Index of the deposit transaction output that funds the revealed deposit |
| `deposit` | [`DepositReceipt`](DepositReceipt.md) | Data of the revealed deposit |
| `vault?` | [`ChainIdentifier`](ChainIdentifier.md) | Optional parameter denoting the vault the given deposit should be routed to |

#### Returns

`Promise`\<[`Hex`](../classes/Hex.md)\>

Transaction hash of the reveal deposit transaction.

#### Defined in

[lib/contracts/cross-chain.ts:138](https://github.com/Unknown-Gravity/tbtc-v2-sdk/blob/main/typescript/src/lib/contracts/cross-chain.ts#L138)
