# Class: EthereumTBTCVault

Implementation of the Ethereum TBTCVault handle.

**`See`**

for reference.

## Hierarchy

- `EthersContractHandle`\<`TBTCVaultTypechain`\>

  ↳ **`EthereumTBTCVault`**

## Implements

- [`TBTCVault`](../interfaces/TBTCVault.md)

## Table of contents

### Constructors

- [constructor](EthereumTBTCVault.md#constructor)

### Properties

- [\_deployedAtBlockNumber](EthereumTBTCVault.md#_deployedatblocknumber)
- [\_instance](EthereumTBTCVault.md#_instance)
- [\_totalRetryAttempts](EthereumTBTCVault.md#_totalretryattempts)

### Methods

- [cancelOptimisticMint](EthereumTBTCVault.md#canceloptimisticmint)
- [finalizeOptimisticMint](EthereumTBTCVault.md#finalizeoptimisticmint)
- [getAddress](EthereumTBTCVault.md#getaddress)
- [getChainIdentifier](EthereumTBTCVault.md#getchainidentifier)
- [getEvents](EthereumTBTCVault.md#getevents)
- [getMinters](EthereumTBTCVault.md#getminters)
- [getOptimisticMintingCancelledEvents](EthereumTBTCVault.md#getoptimisticmintingcancelledevents)
- [getOptimisticMintingFinalizedEvents](EthereumTBTCVault.md#getoptimisticmintingfinalizedevents)
- [getOptimisticMintingRequestedEvents](EthereumTBTCVault.md#getoptimisticmintingrequestedevents)
- [isGuardian](EthereumTBTCVault.md#isguardian)
- [isMinter](EthereumTBTCVault.md#isminter)
- [optimisticMintingDelay](EthereumTBTCVault.md#optimisticmintingdelay)
- [optimisticMintingRequests](EthereumTBTCVault.md#optimisticmintingrequests)
- [parseOptimisticMintingRequest](EthereumTBTCVault.md#parseoptimisticmintingrequest)
- [requestOptimisticMint](EthereumTBTCVault.md#requestoptimisticmint)

## Constructors

### constructor

• **new EthereumTBTCVault**(`config`, `deploymentType?`): [`EthereumTBTCVault`](EthereumTBTCVault.md)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `config` | [`EthereumContractConfig`](../interfaces/EthereumContractConfig.md) | `undefined` |
| `deploymentType` | ``"local"`` \| ``"sepolia"`` \| ``"mainnet"`` | `"local"` |

#### Returns

[`EthereumTBTCVault`](EthereumTBTCVault.md)

#### Overrides

EthersContractHandle\&lt;TBTCVaultTypechain\&gt;.constructor

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:41](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L41)

## Properties

### \_deployedAtBlockNumber

• `Protected` `Readonly` **\_deployedAtBlockNumber**: `number`

Number of a block within which the contract was deployed. Value is read from
the contract deployment artifact. It can be overwritten by setting a
[EthersContractConfig.deployedAtBlockNumber](../interfaces/EthereumContractConfig.md#deployedatblocknumber) property.

#### Inherited from

EthersContractHandle.\_deployedAtBlockNumber

#### Defined in

[src/lib/ethereum/adapter.ts:80](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/adapter.ts#L80)

___

### \_instance

• `Protected` `Readonly` **\_instance**: `TBTCVault`

Ethers instance of the deployed contract.

#### Inherited from

EthersContractHandle.\_instance

#### Defined in

[src/lib/ethereum/adapter.ts:74](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/adapter.ts#L74)

___

### \_totalRetryAttempts

• `Protected` `Readonly` **\_totalRetryAttempts**: `number`

Number of retries for ethereum requests.

#### Inherited from

EthersContractHandle.\_totalRetryAttempts

#### Defined in

[src/lib/ethereum/adapter.ts:84](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/adapter.ts#L84)

## Methods

### cancelOptimisticMint

▸ **cancelOptimisticMint**(`depositTxHash`, `depositOutputIndex`): `Promise`\<[`Hex`](Hex.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `depositTxHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |
| `depositOutputIndex` | `number` |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[cancelOptimisticMint](../interfaces/TBTCVault.md#canceloptimisticmint)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:153](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L153)

___

### finalizeOptimisticMint

▸ **finalizeOptimisticMint**(`depositTxHash`, `depositOutputIndex`): `Promise`\<[`Hex`](Hex.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `depositTxHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |
| `depositOutputIndex` | `number` |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[finalizeOptimisticMint](../interfaces/TBTCVault.md#finalizeoptimisticmint)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:176](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L176)

___

### getAddress

▸ **getAddress**(): [`EthereumAddress`](EthereumAddress.md)

Get address of the contract instance.

#### Returns

[`EthereumAddress`](EthereumAddress.md)

Address of this contract instance.

#### Inherited from

EthersContractHandle.getAddress

#### Defined in

[src/lib/ethereum/adapter.ts:112](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/adapter.ts#L112)

___

### getChainIdentifier

▸ **getChainIdentifier**(): [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

#### Returns

[`ChainIdentifier`](../interfaces/ChainIdentifier.md)

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[getChainIdentifier](../interfaces/TBTCVault.md#getchainidentifier)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:71](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L71)

___

### getEvents

▸ **getEvents**(`eventName`, `options?`, `...filterArgs`): `Promise`\<`Event`[]\>

Get events emitted by the Ethereum contract.
It starts searching from provided block number. If the GetEvents.Options#fromBlock
option is missing it looks for a contract's defined property
[_deployedAtBlockNumber](EthereumBridge.md#_deployedatblocknumber). If the property is missing starts searching
from block `0`.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` | Name of the event. |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) | Options for events fetching. |
| `...filterArgs` | `unknown`[] | Arguments for events filtering. |

#### Returns

`Promise`\<`Event`[]\>

Array of found events.

#### Inherited from

EthersContractHandle.getEvents

#### Defined in

[src/lib/ethereum/adapter.ts:127](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/adapter.ts#L127)

___

### getMinters

▸ **getMinters**(): `Promise`\<[`EthereumAddress`](EthereumAddress.md)[]\>

#### Returns

`Promise`\<[`EthereumAddress`](EthereumAddress.md)[]\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[getMinters](../interfaces/TBTCVault.md#getminters)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:93](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L93)

___

### getOptimisticMintingCancelledEvents

▸ **getOptimisticMintingCancelledEvents**(`options?`, `...filterArgs`): `Promise`\<[`OptimisticMintingCancelledEvent`](../README.md#optimisticmintingcancelledevent)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) |
| `...filterArgs` | `any`[] |

#### Returns

`Promise`\<[`OptimisticMintingCancelledEvent`](../README.md#optimisticmintingcancelledevent)[]\>

**`See`**

#### Implementation of

TBTCVault.getOptimisticMintingCancelledEvents

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:271](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L271)

___

### getOptimisticMintingFinalizedEvents

▸ **getOptimisticMintingFinalizedEvents**(`options?`, `...filterArgs`): `Promise`\<[`OptimisticMintingFinalizedEvent`](../README.md#optimisticmintingfinalizedevent)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) |
| `...filterArgs` | `any`[] |

#### Returns

`Promise`\<[`OptimisticMintingFinalizedEvent`](../README.md#optimisticmintingfinalizedevent)[]\>

**`See`**

#### Implementation of

TBTCVault.getOptimisticMintingFinalizedEvents

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:298](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L298)

___

### getOptimisticMintingRequestedEvents

▸ **getOptimisticMintingRequestedEvents**(`options?`, `...filterArgs`): `Promise`\<[`OptimisticMintingRequestedEvent`](../README.md#optimisticmintingrequestedevent)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) |
| `...filterArgs` | `any`[] |

#### Returns

`Promise`\<[`OptimisticMintingRequestedEvent`](../README.md#optimisticmintingrequestedevent)[]\>

**`See`**

#### Implementation of

TBTCVault.getOptimisticMintingRequestedEvents

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:238](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L238)

___

### isGuardian

▸ **isGuardian**(`address`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | [`EthereumAddress`](EthereumAddress.md) |

#### Returns

`Promise`\<`boolean`\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[isGuardian](../interfaces/TBTCVault.md#isguardian)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:117](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L117)

___

### isMinter

▸ **isMinter**(`address`): `Promise`\<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | [`EthereumAddress`](EthereumAddress.md) |

#### Returns

`Promise`\<`boolean`\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[isMinter](../interfaces/TBTCVault.md#isminter)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:107](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L107)

___

### optimisticMintingDelay

▸ **optimisticMintingDelay**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[optimisticMintingDelay](../interfaces/TBTCVault.md#optimisticmintingdelay)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:79](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L79)

___

### optimisticMintingRequests

▸ **optimisticMintingRequests**(`depositTxHash`, `depositOutputIndex`): `Promise`\<[`OptimisticMintingRequest`](../README.md#optimisticmintingrequest)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `depositTxHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |
| `depositOutputIndex` | `number` |

#### Returns

`Promise`\<[`OptimisticMintingRequest`](../README.md#optimisticmintingrequest)\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[optimisticMintingRequests](../interfaces/TBTCVault.md#optimisticmintingrequests)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:202](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L202)

___

### parseOptimisticMintingRequest

▸ **parseOptimisticMintingRequest**(`request`): [`OptimisticMintingRequest`](../README.md#optimisticmintingrequest)

Parses a optimistic minting request using data fetched from the on-chain contract.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request` | `ContractOptimisticMintingRequest` | Data of the optimistic minting request. |

#### Returns

[`OptimisticMintingRequest`](../README.md#optimisticmintingrequest)

Parsed optimistic minting request.

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:225](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L225)

___

### requestOptimisticMint

▸ **requestOptimisticMint**(`depositTxHash`, `depositOutputIndex`): `Promise`\<[`Hex`](Hex.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `depositTxHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |
| `depositOutputIndex` | `number` |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

**`See`**

#### Implementation of

[TBTCVault](../interfaces/TBTCVault.md).[requestOptimisticMint](../interfaces/TBTCVault.md#requestoptimisticmint)

#### Defined in

[src/lib/ethereum/tbtc-vault.ts:127](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/tbtc-vault.ts#L127)
