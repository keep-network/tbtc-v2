# Class: SuiTBTCToken

Implementation of the DestinationChainTBTCToken interface for the SUI network.

## Implements

- [`DestinationChainTBTCToken`](../interfaces/DestinationChainTBTCToken.md)

## Table of contents

### Constructors

- [constructor](SuiTBTCToken.md#constructor)

### Properties

- [#coinType](SuiTBTCToken.md##cointype)
- [#contractAddress](SuiTBTCToken.md##contractaddress)
- [#suiClient](SuiTBTCToken.md##suiclient)

### Methods

- [balanceOf](SuiTBTCToken.md#balanceof)
- [getChainIdentifier](SuiTBTCToken.md#getchainidentifier)

## Constructors

### constructor

• **new SuiTBTCToken**(`suiClient`, `contractAddress`, `coinType`): [`SuiTBTCToken`](SuiTBTCToken.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `suiClient` | `SuiClient` |
| `contractAddress` | `string` |
| `coinType` | `string` |

#### Returns

[`SuiTBTCToken`](SuiTBTCToken.md)

#### Defined in

[lib/sui/sui-tbtc-token.ts:19](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L19)

## Properties

### #coinType

• `Private` `Readonly` **#coinType**: `string`

#### Defined in

[lib/sui/sui-tbtc-token.ts:17](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L17)

___

### #contractAddress

• `Private` `Readonly` **#contractAddress**: [`SuiAddress`](SuiAddress.md)

#### Defined in

[lib/sui/sui-tbtc-token.ts:16](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L16)

___

### #suiClient

• `Private` `Readonly` **#suiClient**: `SuiClient`

#### Defined in

[lib/sui/sui-tbtc-token.ts:15](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L15)

## Methods

### balanceOf

▸ **balanceOf**(`identifier`): `Promise`\<`BigNumber`\>

Returns the balance of the given identifier.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `identifier` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) | Identifier of the account to get the balance for. |

#### Returns

`Promise`\<`BigNumber`\>

The balance of the given identifier in 1e18 precision.

#### Implementation of

[DestinationChainTBTCToken](../interfaces/DestinationChainTBTCToken.md).[balanceOf](../interfaces/DestinationChainTBTCToken.md#balanceof)

#### Defined in

[lib/sui/sui-tbtc-token.ts:29](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L29)

___

### getChainIdentifier

▸ **getChainIdentifier**(): [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Gets the chain-specific identifier of this contract.

#### Returns

[`ChainIdentifier`](../interfaces/ChainIdentifier.md)

#### Implementation of

[DestinationChainTBTCToken](../interfaces/DestinationChainTBTCToken.md).[getChainIdentifier](../interfaces/DestinationChainTBTCToken.md#getchainidentifier)

#### Defined in

[lib/sui/sui-tbtc-token.ts:25](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L25)
