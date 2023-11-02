[@keep-network/tbtc-v2.ts](../README.md) / Wallet

# Interface: Wallet

Represents a deposit.

## Table of contents

### Properties

- [closingStartedAt](Wallet.md#closingstartedat)
- [createdAt](Wallet.md#createdat)
- [ecdsaWalletID](Wallet.md#ecdsawalletid)
- [mainUtxoHash](Wallet.md#mainutxohash)
- [movingFundsRequestedAt](Wallet.md#movingfundsrequestedat)
- [movingFundsTargetWalletsCommitmentHash](Wallet.md#movingfundstargetwalletscommitmenthash)
- [pendingMovedFundsSweepRequestsCount](Wallet.md#pendingmovedfundssweeprequestscount)
- [pendingRedemptionsValue](Wallet.md#pendingredemptionsvalue)
- [state](Wallet.md#state)
- [walletPublicKey](Wallet.md#walletpublickey)

## Properties

### closingStartedAt

• **closingStartedAt**: `number`

UNIX timestamp indicating the moment the wallet's closing period started.

#### Defined in

[lib/contracts/bridge.ts:427](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L427)

___

### createdAt

• **createdAt**: `number`

UNIX timestamp the wallet was created at.

#### Defined in

[lib/contracts/bridge.ts:418](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L418)

___

### ecdsaWalletID

• **ecdsaWalletID**: [`Hex`](../classes/Hex.md)

Identifier of a ECDSA Wallet registered in the ECDSA Wallet Registry.

#### Defined in

[lib/contracts/bridge.ts:402](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L402)

___

### mainUtxoHash

• **mainUtxoHash**: [`Hex`](../classes/Hex.md)

Latest wallet's main UTXO hash.

#### Defined in

[lib/contracts/bridge.ts:410](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L410)

___

### movingFundsRequestedAt

• **movingFundsRequestedAt**: `number`

UNIX timestamp indicating the moment the wallet was requested to move their
funds.

#### Defined in

[lib/contracts/bridge.ts:423](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L423)

___

### movingFundsTargetWalletsCommitmentHash

• **movingFundsTargetWalletsCommitmentHash**: [`Hex`](../classes/Hex.md)

Moving funds target wallet commitment submitted by the wallet.

#### Defined in

[lib/contracts/bridge.ts:439](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L439)

___

### pendingMovedFundsSweepRequestsCount

• **pendingMovedFundsSweepRequestsCount**: `number`

Total count of pending moved funds sweep requests targeting this wallet.

#### Defined in

[lib/contracts/bridge.ts:431](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L431)

___

### pendingRedemptionsValue

• **pendingRedemptionsValue**: `BigNumber`

The total redeemable value of pending redemption requests targeting that wallet.

#### Defined in

[lib/contracts/bridge.ts:414](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L414)

___

### state

• **state**: [`WalletState`](../enums/WalletState-1.md)

Current state of the wallet.

#### Defined in

[lib/contracts/bridge.ts:435](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L435)

___

### walletPublicKey

• **walletPublicKey**: [`Hex`](../classes/Hex.md)

Compressed public key of the ECDSA Wallet.

#### Defined in

[lib/contracts/bridge.ts:406](https://github.com/keep-network/tbtc-v2/blob/807249d0/typescript/src/lib/contracts/bridge.ts#L406)
