# Namespace: BitcoinNetwork

## Table of contents

### Functions

- [fromGenesisHash](BitcoinNetwork.md#fromgenesishash)

## Functions

### fromGenesisHash

▸ **fromGenesisHash**(`hash`): [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md)

Gets Bitcoin Network type by comparing a provided hash to known
[genesis block hashes](https://en.bitcoin.it/wiki/Genesis_block).
Returns [BitcoinNetwork.Unknown](../enums/BitcoinNetwork-1.md#unknown)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `hash` | [`Hex`](../classes/Hex.md) | Hash of a block. |

#### Returns

[`BitcoinNetwork`](../enums/BitcoinNetwork-1.md)

Bitcoin Network.

#### Defined in

[lib/bitcoin/network.ts:33](https://github.com/Unknown-Gravity/tbtc-v2-sdk/blob/main/typescript/src/lib/bitcoin/network.ts#L33)
