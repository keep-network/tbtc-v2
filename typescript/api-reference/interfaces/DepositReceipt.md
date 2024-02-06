# Interface: DepositReceipt

Represents a deposit receipt. The receipt holds all information required
to build a unique deposit address on Bitcoin chain.

## Table of contents

### Properties

- [blindingFactor](DepositReceipt.md#blindingfactor)
- [depositor](DepositReceipt.md#depositor)
- [extraData](DepositReceipt.md#extradata)
- [refundLocktime](DepositReceipt.md#refundlocktime)
- [refundPublicKeyHash](DepositReceipt.md#refundpublickeyhash)
- [walletPublicKeyHash](DepositReceipt.md#walletpublickeyhash)

## Properties

### blindingFactor

• **blindingFactor**: [`Hex`](../classes/Hex.md)

An 8-byte blinding factor. Must be unique for the given depositor, wallet
public key and refund public key.

#### Defined in

[src/lib/contracts/bridge.ts:198](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L198)

___

### depositor

• **depositor**: [`ChainIdentifier`](ChainIdentifier.md)

Depositor's chain identifier.

#### Defined in

[src/lib/contracts/bridge.ts:192](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L192)

___

### extraData

• `Optional` **extraData**: [`Hex`](../classes/Hex.md)

Optional 32-byte extra data.

#### Defined in

[src/lib/contracts/bridge.ts:223](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L223)

___

### refundLocktime

• **refundLocktime**: [`Hex`](../classes/Hex.md)

A 4-byte little-endian refund locktime.

#### Defined in

[src/lib/contracts/bridge.ts:218](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L218)

___

### refundPublicKeyHash

• **refundPublicKeyHash**: [`Hex`](../classes/Hex.md)

Public key hash that is meant to be used during deposit refund after the
locktime passes.

You can use `computeHash160` function to get the hash from a public key.

#### Defined in

[src/lib/contracts/bridge.ts:213](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L213)

___

### walletPublicKeyHash

• **walletPublicKeyHash**: [`Hex`](../classes/Hex.md)

Public key hash of the wallet that is meant to receive the deposit.

You can use `computeHash160` function to get the hash from a public key.

#### Defined in

[src/lib/contracts/bridge.ts:205](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L205)
