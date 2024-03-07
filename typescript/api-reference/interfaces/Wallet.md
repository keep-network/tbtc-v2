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

[src/lib/contracts/bridge.ts:437](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L437)

___

### createdAt

• **createdAt**: `number`

UNIX timestamp the wallet was created at.

#### Defined in

[src/lib/contracts/bridge.ts:428](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L428)

___

### ecdsaWalletID

• **ecdsaWalletID**: [`Hex`](../classes/Hex.md)

Identifier of a ECDSA Wallet registered in the ECDSA Wallet Registry.

#### Defined in

[src/lib/contracts/bridge.ts:412](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L412)

___

### mainUtxoHash

• **mainUtxoHash**: [`Hex`](../classes/Hex.md)

Latest wallet's main UTXO hash.

#### Defined in

[src/lib/contracts/bridge.ts:420](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L420)

___

### movingFundsRequestedAt

• **movingFundsRequestedAt**: `number`

UNIX timestamp indicating the moment the wallet was requested to move their
funds.

#### Defined in

[src/lib/contracts/bridge.ts:433](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L433)

___

### movingFundsTargetWalletsCommitmentHash

• **movingFundsTargetWalletsCommitmentHash**: [`Hex`](../classes/Hex.md)

Moving funds target wallet commitment submitted by the wallet.

#### Defined in

[src/lib/contracts/bridge.ts:449](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L449)

___

### pendingMovedFundsSweepRequestsCount

• **pendingMovedFundsSweepRequestsCount**: `number`

Total count of pending moved funds sweep requests targeting this wallet.

#### Defined in

[src/lib/contracts/bridge.ts:441](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L441)

___

### pendingRedemptionsValue

• **pendingRedemptionsValue**: `BigNumber`

The total redeemable value of pending redemption requests targeting that wallet.

#### Defined in

[src/lib/contracts/bridge.ts:424](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L424)

___

### state

• **state**: [`WalletState`](../enums/WalletState-1.md)

Current state of the wallet.

#### Defined in

[src/lib/contracts/bridge.ts:445](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L445)

___

### walletPublicKey

• **walletPublicKey**: [`Hex`](../classes/Hex.md)

Compressed public key of the ECDSA Wallet.

#### Defined in

[src/lib/contracts/bridge.ts:416](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/contracts/bridge.ts#L416)
