[@keep-network/tbtc-v2.ts](../README.md) / BitcoinTxMerkleBranch

# Interface: BitcoinTxMerkleBranch

Information about the merkle branch to a confirmed transaction.

## Table of contents

### Properties

- [blockHeight](BitcoinTxMerkleBranch.md#blockheight)
- [merkle](BitcoinTxMerkleBranch.md#merkle)
- [position](BitcoinTxMerkleBranch.md#position)

## Properties

### blockHeight

• **blockHeight**: `number`

The height of the block the transaction was confirmed in.

#### Defined in

[lib/bitcoin/spv.ts:41](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/spv.ts#L41)

___

### merkle

• **merkle**: [`Hex`](../classes/Hex.md)[]

A list of transaction hashes the current hash is paired with, recursively,
in order to trace up to obtain the merkle root of the including block,
the deepest pairing first. Each hash is an unprefixed hex string.

#### Defined in

[lib/bitcoin/spv.ts:48](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/spv.ts#L48)

___

### position

• **position**: `number`

The 0-based index of the transaction's position in the block.

#### Defined in

[lib/bitcoin/spv.ts:53](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/spv.ts#L53)
