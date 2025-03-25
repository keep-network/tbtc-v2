# Interface: DestinationChainTBTCToken

Interface for communication with the on-chain contract of the given
canonical destination chain tBTC token.

## Implemented by

- [`ArbitrumL2TBTCToken`](../classes/ArbitrumL2TBTCToken.md)
- [`BaseL2TBTCToken`](../classes/BaseL2TBTCToken.md)

## Table of contents

### Methods

- [balanceOf](DestinationChainTBTCToken.md#balanceof)
- [getChainIdentifier](DestinationChainTBTCToken.md#getchainidentifier)

## Methods

### balanceOf

▸ **balanceOf**(`identifier`): `Promise`\<`BigNumber`\>

Returns the balance of the given identifier.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `identifier` | [`ChainIdentifier`](ChainIdentifier.md) | Identifier of the account to get the balance for. |

#### Returns

`Promise`\<`BigNumber`\>

The balance of the given identifier in 1e18 precision.

#### Defined in

[lib/contracts/cross-chain.ts:64](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/cross-chain.ts#L64)

___

### getChainIdentifier

▸ **getChainIdentifier**(): [`ChainIdentifier`](ChainIdentifier.md)

Gets the chain-specific identifier of this contract.

#### Returns

[`ChainIdentifier`](ChainIdentifier.md)

#### Defined in

[lib/contracts/cross-chain.ts:57](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/cross-chain.ts#L57)
