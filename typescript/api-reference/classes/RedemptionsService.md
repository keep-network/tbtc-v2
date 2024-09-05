# Class: RedemptionsService

Service exposing features related to tBTC v2 redemptions.

## Table of contents

### Constructors

- [constructor](RedemptionsService.md#constructor)

### Properties

- [bitcoinClient](RedemptionsService.md#bitcoinclient)
- [tbtcContracts](RedemptionsService.md#tbtccontracts)

### Methods

- [determineRedemptionData](RedemptionsService.md#determineredemptiondata)
- [determineWalletMainUtxo](RedemptionsService.md#determinewalletmainutxo)
- [findWalletForRedemption](RedemptionsService.md#findwalletforredemption)
- [getRedemptionRequests](RedemptionsService.md#getredemptionrequests)
- [requestRedemption](RedemptionsService.md#requestredemption)
- [requestRedemptionWithProxy](RedemptionsService.md#requestredemptionwithproxy)

## Constructors

### constructor

• **new RedemptionsService**(`tbtcContracts`, `bitcoinClient`): [`RedemptionsService`](RedemptionsService.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `tbtcContracts` | [`TBTCContracts`](../README.md#tbtccontracts) |
| `bitcoinClient` | [`BitcoinClient`](../interfaces/BitcoinClient.md) |

#### Returns

[`RedemptionsService`](RedemptionsService.md)

#### Defined in

[services/redemptions/redemptions-service.ts:31](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L31)

## Properties

### bitcoinClient

• `Private` `Readonly` **bitcoinClient**: [`BitcoinClient`](../interfaces/BitcoinClient.md)

Bitcoin client handle.

#### Defined in

[services/redemptions/redemptions-service.ts:29](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L29)

___

### tbtcContracts

• `Private` `Readonly` **tbtcContracts**: [`TBTCContracts`](../README.md#tbtccontracts)

Handle to tBTC contracts.

#### Defined in

[services/redemptions/redemptions-service.ts:25](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L25)

## Methods

### determineRedemptionData

▸ **determineRedemptionData**(`bitcoinRedeemerAddress`, `amount`): `Promise`\<\{ `mainUtxo`: [`BitcoinUtxo`](../README.md#bitcoinutxo) ; `redeemerOutputScript`: [`Hex`](Hex.md) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinRedeemerAddress` | `string` | Bitcoin address redeemed BTC should be sent to. Only P2PKH, P2WPKH, P2SH, and P2WSH address types are supported. |
| `amount` | `BigNumber` | The amount to be redeemed with the precision of the tBTC on-chain token contract. |

#### Returns

`Promise`\<\{ `mainUtxo`: [`BitcoinUtxo`](../README.md#bitcoinutxo) ; `redeemerOutputScript`: [`Hex`](Hex.md) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Object containing:
         - Bitcoin public key of the wallet asked to handle the redemption.
           Presented in the compressed form (33 bytes long with 02 or 03 prefix).
         - Main UTXO of the wallet.
         - Redeemer output script.

#### Defined in

[services/redemptions/redemptions-service.ts:132](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L132)

___

### determineWalletMainUtxo

▸ **determineWalletMainUtxo**(`walletPublicKeyHash`, `bitcoinNetwork`): `Promise`\<`undefined` \| [`BitcoinUtxo`](../README.md#bitcoinutxo)\>

Determines the plain-text wallet main UTXO currently registered in the
Bridge on-chain contract. The returned main UTXO can be undefined if the
wallet does not have a main UTXO registered in the Bridge at the moment.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `walletPublicKeyHash` | [`Hex`](Hex.md) | Public key hash of the wallet. |
| `bitcoinNetwork` | [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md) | Bitcoin network. |

#### Returns

`Promise`\<`undefined` \| [`BitcoinUtxo`](../README.md#bitcoinutxo)\>

Promise holding the wallet main UTXO or undefined value.

#### Defined in

[services/redemptions/redemptions-service.ts:302](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L302)

___

### findWalletForRedemption

▸ **findWalletForRedemption**(`redeemerOutputScript`, `amount`): `Promise`\<\{ `mainUtxo`: [`BitcoinUtxo`](../README.md#bitcoinutxo) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Finds the oldest live wallet that has enough BTC to handle a redemption
request.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `redeemerOutputScript` | [`Hex`](Hex.md) | The redeemer output script the redeemed funds are supposed to be locked on. Must not be prepended with length. |
| `amount` | `BigNumber` | The amount to be redeemed in satoshis. |

#### Returns

`Promise`\<\{ `mainUtxo`: [`BitcoinUtxo`](../README.md#bitcoinutxo) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Promise with the wallet details needed to request a redemption.

#### Defined in

[services/redemptions/redemptions-service.ts:181](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L181)

___

### getRedemptionRequests

▸ **getRedemptionRequests**(`bitcoinRedeemerAddress`, `walletPublicKey`, `type?`): `Promise`\<[`RedemptionRequest`](../interfaces/RedemptionRequest.md)\>

Gets data of a registered redemption request from the Bridge contract.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `bitcoinRedeemerAddress` | `string` | `undefined` | Bitcoin redeemer address used to request the redemption. |
| `walletPublicKey` | [`Hex`](Hex.md) | `undefined` | Bitcoin public key of the wallet handling the redemption. Must be in the compressed form (33 bytes long with 02 or 03 prefix). |
| `type` | ``"pending"`` \| ``"timedOut"`` | `"pending"` | Type of redemption requests the function will look for. Can be either `pending` or `timedOut`. By default, `pending` is used. |

#### Returns

`Promise`\<[`RedemptionRequest`](../interfaces/RedemptionRequest.md)\>

Matching redemption requests.

**`Throws`**

Throws an error if no redemption request exists for the given
        input parameters.

#### Defined in

[services/redemptions/redemptions-service.ts:414](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L414)

___

### requestRedemption

▸ **requestRedemption**(`bitcoinRedeemerAddress`, `amount`): `Promise`\<\{ `targetChainTxHash`: [`Hex`](Hex.md) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Requests a redemption of TBTC v2 token into BTC.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinRedeemerAddress` | `string` | Bitcoin address redeemed BTC should be sent to. Only P2PKH, P2WPKH, P2SH, and P2WSH address types are supported. |
| `amount` | `BigNumber` | The amount to be redeemed with the precision of the tBTC on-chain token contract. |

#### Returns

`Promise`\<\{ `targetChainTxHash`: [`Hex`](Hex.md) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Object containing:
         - Target chain hash of the request redemption transaction
           (for example, Ethereum transaction hash)
         - Bitcoin public key of the wallet asked to handle the redemption.
           Presented in the compressed form (33 bytes long with 02 or 03 prefix).

#### Defined in

[services/redemptions/redemptions-service.ts:49](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L49)

___

### requestRedemptionWithProxy

▸ **requestRedemptionWithProxy**(`bitcoinRedeemerAddress`, `amount`, `redeemerProxy`): `Promise`\<\{ `targetChainTxHash`: [`Hex`](Hex.md) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Requests a redemption of TBTC v2 token into BTC using a custom integration.
The function builds the redemption data and handles the redemption request
through the provided redeemer proxy.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinRedeemerAddress` | `string` | Bitcoin address the redeemed BTC should be sent to. Only P2PKH, P2WPKH, P2SH, and P2WSH address types are supported. |
| `amount` | `BigNumberish` | The amount to be redeemed with the precision of the tBTC on-chain token contract. |
| `redeemerProxy` | [`RedeemerProxy`](../interfaces/RedeemerProxy.md) | Object impleenting functions required to route tBTC redemption requests through the tBTC bridge. |

#### Returns

`Promise`\<\{ `targetChainTxHash`: [`Hex`](Hex.md) ; `walletPublicKey`: [`Hex`](Hex.md)  }\>

Object containing:
         - Target chain hash of the request redemption transaction
           (for example, Ethereum transaction hash)
         - Bitcoin public key of the wallet asked to handle the redemption.
           Presented in the compressed form (33 bytes long with 02 or 03 prefix).

#### Defined in

[services/redemptions/redemptions-service.ts:88](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/redemptions/redemptions-service.ts#L88)
