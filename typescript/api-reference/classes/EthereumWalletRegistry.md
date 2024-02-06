# Class: EthereumWalletRegistry

Implementation of the Ethereum WalletRegistry handle.

**`See`**

for reference.

## Hierarchy

- `EthersContractHandle`\<`WalletRegistryTypechain`\>

  ↳ **`EthereumWalletRegistry`**

## Implements

- [`WalletRegistry`](../interfaces/WalletRegistry.md)

## Table of contents

### Constructors

- [constructor](EthereumWalletRegistry.md#constructor)

### Properties

- [\_deployedAtBlockNumber](EthereumWalletRegistry.md#_deployedatblocknumber)
- [\_instance](EthereumWalletRegistry.md#_instance)
- [\_totalRetryAttempts](EthereumWalletRegistry.md#_totalretryattempts)

### Methods

- [getAddress](EthereumWalletRegistry.md#getaddress)
- [getChainIdentifier](EthereumWalletRegistry.md#getchainidentifier)
- [getDkgResultApprovedEvents](EthereumWalletRegistry.md#getdkgresultapprovedevents)
- [getDkgResultChallengedEvents](EthereumWalletRegistry.md#getdkgresultchallengedevents)
- [getDkgResultSubmittedEvents](EthereumWalletRegistry.md#getdkgresultsubmittedevents)
- [getEvents](EthereumWalletRegistry.md#getevents)
- [getWalletPublicKey](EthereumWalletRegistry.md#getwalletpublickey)

## Constructors

### constructor

• **new EthereumWalletRegistry**(`config`, `deploymentType?`): [`EthereumWalletRegistry`](EthereumWalletRegistry.md)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `config` | [`EthereumContractConfig`](../interfaces/EthereumContractConfig.md) | `undefined` |
| `deploymentType` | ``"local"`` \| ``"sepolia"`` \| ``"mainnet"`` | `"local"` |

#### Returns

[`EthereumWalletRegistry`](EthereumWalletRegistry.md)

#### Overrides

EthersContractHandle\&lt;WalletRegistryTypechain\&gt;.constructor

#### Defined in

[src/lib/ethereum/wallet-registry.ts:32](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/wallet-registry.ts#L32)

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

• `Protected` `Readonly` **\_instance**: `WalletRegistry`

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

[WalletRegistry](../interfaces/WalletRegistry.md).[getChainIdentifier](../interfaces/WalletRegistry.md#getchainidentifier)

#### Defined in

[src/lib/ethereum/wallet-registry.ts:59](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/wallet-registry.ts#L59)

___

### getDkgResultApprovedEvents

▸ **getDkgResultApprovedEvents**(`options?`, `...filterArgs`): `Promise`\<[`DkgResultApprovedEvent`](../README.md#dkgresultapprovedevent)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) |
| `...filterArgs` | `unknown`[] |

#### Returns

`Promise`\<[`DkgResultApprovedEvent`](../README.md#dkgresultapprovedevent)[]\>

**`See`**

#### Implementation of

WalletRegistry.getDkgResultApprovedEvents

#### Defined in

[src/lib/ethereum/wallet-registry.ts:125](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/wallet-registry.ts#L125)

___

### getDkgResultChallengedEvents

▸ **getDkgResultChallengedEvents**(`options?`, `...filterArgs`): `Promise`\<[`DkgResultChallengedEvent`](../README.md#dkgresultchallengedevent)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) |
| `...filterArgs` | `unknown`[] |

#### Returns

`Promise`\<[`DkgResultChallengedEvent`](../README.md#dkgresultchallengedevent)[]\>

**`See`**

#### Implementation of

WalletRegistry.getDkgResultChallengedEvents

#### Defined in

[src/lib/ethereum/wallet-registry.ts:150](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/wallet-registry.ts#L150)

___

### getDkgResultSubmittedEvents

▸ **getDkgResultSubmittedEvents**(`options?`, `...filterArgs`): `Promise`\<[`DkgResultSubmittedEvent`](../README.md#dkgresultsubmittedevent)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `options?` | [`Options`](../interfaces/GetChainEvents.Options.md) |
| `...filterArgs` | `unknown`[] |

#### Returns

`Promise`\<[`DkgResultSubmittedEvent`](../README.md#dkgresultsubmittedevent)[]\>

**`See`**

#### Implementation of

WalletRegistry.getDkgResultSubmittedEvents

#### Defined in

[src/lib/ethereum/wallet-registry.ts:82](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/wallet-registry.ts#L82)

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

### getWalletPublicKey

▸ **getWalletPublicKey**(`walletID`): `Promise`\<[`Hex`](Hex.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `walletID` | [`Hex`](Hex.md) |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

**`See`**

#### Implementation of

[WalletRegistry](../interfaces/WalletRegistry.md).[getWalletPublicKey](../interfaces/WalletRegistry.md#getwalletpublickey)

#### Defined in

[src/lib/ethereum/wallet-registry.ts:67](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/wallet-registry.ts#L67)
