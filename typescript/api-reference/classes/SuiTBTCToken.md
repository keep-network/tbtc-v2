# Class: SuiTBTCToken

SUI implementation of the DestinationChainTBTCToken interface.

Communicates with the TBTC token smart contract deployed on the SUI blockchain.
The SUI implementation of TBTC (defined in `tbtc.move`) uses 9 decimal places,
while standard Ethereum tokens use 18 decimal places.

## Decimal Precision Handling

From the SUI contract in `tbtc.move`:
```move
let (treasury_cap, metadata) = coin::create_currency(
    witness,
    9, // Bitcoin uses 8 decimals, but many chains use 9 for tBTC
    b"TBTC",
    // ...
);
```

The `balanceOf` method automatically adjusts the returned balance:
1. Fetches the raw balance from SUI (with 9 decimal places)
2. Converts it to a standard 18-decimal BigNumber by multiplying by 10^9 
   This ensures consistent precision with other chain implementations

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

[lib/sui/sui-tbtc-token.ts:44](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L44)

## Properties

### #coinType

• `Private` `Readonly` **#coinType**: `string`

#### Defined in

[lib/sui/sui-tbtc-token.ts:42](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L42)

___

### #contractAddress

• `Private` `Readonly` **#contractAddress**: [`SuiAddress`](SuiAddress.md)

#### Defined in

[lib/sui/sui-tbtc-token.ts:41](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L41)

___

### #suiClient

• `Private` `Readonly` **#suiClient**: `SuiClient`

#### Defined in

[lib/sui/sui-tbtc-token.ts:40](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L40)

## Methods

### balanceOf

▸ **balanceOf**(`owner`): `Promise`\<`BigNumber`\>

Get the balance of TBTC tokens for the given owner address.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `owner` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) | The SUI address to check balance for. |

#### Returns

`Promise`\<`BigNumber`\>

Promise<BigNumber> The token balance adjusted to 18 decimal places.

**`Throws`**

If the owner is not a SuiAddress.

#### Implementation of

[DestinationChainTBTCToken](../interfaces/DestinationChainTBTCToken.md).[balanceOf](../interfaces/DestinationChainTBTCToken.md#balanceof)

#### Defined in

[lib/sui/sui-tbtc-token.ts:64](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L64)

___

### getChainIdentifier

▸ **getChainIdentifier**(): [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Get chain identifier of the contract.

#### Returns

[`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Chain identifier of the contract.

#### Implementation of

[DestinationChainTBTCToken](../interfaces/DestinationChainTBTCToken.md).[getChainIdentifier](../interfaces/DestinationChainTBTCToken.md#getchainidentifier)

#### Defined in

[lib/sui/sui-tbtc-token.ts:54](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/sui/sui-tbtc-token.ts#L54)
