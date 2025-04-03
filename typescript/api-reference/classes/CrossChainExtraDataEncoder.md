# Class: CrossChainExtraDataEncoder

Implementation of the CrossChainExtraDataEncoder
that handles both Ethereum (20-byte) and Solana/SUI (32-byte) addresses.
It relies on the destination chain context provided during instantiation
to differentiate between 32-byte address formats (Solana vs SUI).

## Implements

- [`ExtraDataEncoder`](../interfaces/ExtraDataEncoder.md)

## Table of contents

### Constructors

- [constructor](CrossChainExtraDataEncoder.md#constructor)

### Properties

- [destinationChainName](CrossChainExtraDataEncoder.md#destinationchainname)

### Methods

- [decodeDepositOwner](CrossChainExtraDataEncoder.md#decodedepositowner)
- [encodeDepositOwner](CrossChainExtraDataEncoder.md#encodedepositowner)

## Constructors

### constructor

• **new CrossChainExtraDataEncoder**(`destinationChainName`): [`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `destinationChainName` | [`DestinationChainName`](../README.md#destinationchainname) |

#### Returns

[`CrossChainExtraDataEncoder`](CrossChainExtraDataEncoder.md)

#### Defined in

[lib/ethereum/l1-bitcoin-depositor.ts:170](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/l1-bitcoin-depositor.ts#L170)

## Properties

### destinationChainName

• `Private` **destinationChainName**: [`DestinationChainName`](../README.md#destinationchainname)

#### Defined in

[lib/ethereum/l1-bitcoin-depositor.ts:170](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/l1-bitcoin-depositor.ts#L170)

## Methods

### decodeDepositOwner

▸ **decodeDepositOwner**(`extraData`): [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `extraData` | [`Hex`](Hex.md) |

#### Returns

[`ChainIdentifier`](../interfaces/ChainIdentifier.md)

**`See`**

#### Implementation of

[ExtraDataEncoder](../interfaces/ExtraDataEncoder.md).[decodeDepositOwner](../interfaces/ExtraDataEncoder.md#decodedepositowner)

#### Defined in

[lib/ethereum/l1-bitcoin-depositor.ts:192](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/l1-bitcoin-depositor.ts#L192)

___

### encodeDepositOwner

▸ **encodeDepositOwner**(`depositOwner`): [`Hex`](Hex.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `depositOwner` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) |

#### Returns

[`Hex`](Hex.md)

**`See`**

#### Implementation of

[ExtraDataEncoder](../interfaces/ExtraDataEncoder.md).[encodeDepositOwner](../interfaces/ExtraDataEncoder.md#encodedepositowner)

#### Defined in

[lib/ethereum/l1-bitcoin-depositor.ts:176](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/ethereum/l1-bitcoin-depositor.ts#L176)
