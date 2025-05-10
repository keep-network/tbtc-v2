# Interface: SerializableWallet

## Table of contents

### Properties

- [index](SerializableWallet.md#index)
- [mainUtxo](SerializableWallet.md#mainutxo)
- [walletBTCBalance](SerializableWallet.md#walletbtcbalance)
- [walletPublicKey](SerializableWallet.md#walletpublickey)

## Properties

### index

• **index**: `number`

Index of the wallet in the list of wallets.

#### Defined in

[lib/utils/types.ts:31](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/types.ts#L31)

___

### mainUtxo

• **mainUtxo**: `Object`

Main UTXO of the wallet.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `outputIndex` | `number` | Output index of the UTXO. |
| `transactionHash` | `string` | Transaction hash of the UTXO. |
| `value` | `string` | Value of the UTXO in satoshis. |

#### Defined in

[lib/utils/types.ts:41](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/types.ts#L41)

___

### walletBTCBalance

• **walletBTCBalance**: `string`

Balance of the wallet in BTC.

#### Defined in

[lib/utils/types.ts:61](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/types.ts#L61)

___

### walletPublicKey

• **walletPublicKey**: `string`

Public key of the wallet.

#### Defined in

[lib/utils/types.ts:36](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/types.ts#L36)
