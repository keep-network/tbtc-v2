# Interface: CrossChainContractsLoader

Interface for loading TBTC cross-chain contracts for a specific L2 chain.
It should be implemented for each supported L1 chain tBTC ledger is deployed
on.

## Table of contents

### Properties

- [loadChainMapping](CrossChainContractsLoader.md#loadchainmapping)
- [loadL1Contracts](CrossChainContractsLoader.md#loadl1contracts)

## Properties

### loadChainMapping

• **loadChainMapping**: () => `undefined` \| [`ChainMapping`](../README.md#chainmapping)

#### Type declaration

▸ (): `undefined` \| [`ChainMapping`](../README.md#chainmapping)

Loads the chain mapping based on underlying L1 chain.

##### Returns

`undefined` \| [`ChainMapping`](../README.md#chainmapping)

#### Defined in

[lib/contracts/cross-chain.ts:40](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/cross-chain.ts#L40)

___

### loadL1Contracts

• **loadL1Contracts**: (`destinationChainName`: [`DestinationChainName`](../README.md#destinationchainname)) => `Promise`\<[`L1CrossChainContracts`](../README.md#l1crosschaincontracts)\>

#### Type declaration

▸ (`destinationChainName`): `Promise`\<[`L1CrossChainContracts`](../README.md#l1crosschaincontracts)\>

Loads L1-specific TBTC cross-chain contracts for the given destination chain.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `destinationChainName` | [`DestinationChainName`](../README.md#destinationchainname) | Name of the destination chain for which to load L1 contracts. |

##### Returns

`Promise`\<[`L1CrossChainContracts`](../README.md#l1crosschaincontracts)\>

#### Defined in

[lib/contracts/cross-chain.ts:45](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/cross-chain.ts#L45)
