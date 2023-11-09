# Class: LedgerLiveAppEthereumSigner

## Hierarchy

- `Signer`

  ↳ **`LedgerLiveAppEthereumSigner`**

## Table of contents

### Constructors

- [constructor](LedgerLiveAppEthereumSigner.md#constructor)

### Properties

- [\_account](LedgerLiveAppEthereumSigner.md#_account)
- [\_isSigner](LedgerLiveAppEthereumSigner.md#_issigner)
- [\_walletApiClient](LedgerLiveAppEthereumSigner.md#_walletapiclient)
- [\_windowMessageTransport](LedgerLiveAppEthereumSigner.md#_windowmessagetransport)
- [provider](LedgerLiveAppEthereumSigner.md#provider)

### Accessors

- [account](LedgerLiveAppEthereumSigner.md#account)

### Methods

- [\_checkProvider](LedgerLiveAppEthereumSigner.md#_checkprovider)
- [call](LedgerLiveAppEthereumSigner.md#call)
- [checkTransaction](LedgerLiveAppEthereumSigner.md#checktransaction)
- [connect](LedgerLiveAppEthereumSigner.md#connect)
- [estimateGas](LedgerLiveAppEthereumSigner.md#estimategas)
- [getAccountId](LedgerLiveAppEthereumSigner.md#getaccountid)
- [getAddress](LedgerLiveAppEthereumSigner.md#getaddress)
- [getBalance](LedgerLiveAppEthereumSigner.md#getbalance)
- [getChainId](LedgerLiveAppEthereumSigner.md#getchainid)
- [getFeeData](LedgerLiveAppEthereumSigner.md#getfeedata)
- [getGasPrice](LedgerLiveAppEthereumSigner.md#getgasprice)
- [getTransactionCount](LedgerLiveAppEthereumSigner.md#gettransactioncount)
- [populateTransaction](LedgerLiveAppEthereumSigner.md#populatetransaction)
- [requestAccount](LedgerLiveAppEthereumSigner.md#requestaccount)
- [resolveName](LedgerLiveAppEthereumSigner.md#resolvename)
- [sendTransaction](LedgerLiveAppEthereumSigner.md#sendtransaction)
- [setAccount](LedgerLiveAppEthereumSigner.md#setaccount)
- [signMessage](LedgerLiveAppEthereumSigner.md#signmessage)
- [signTransaction](LedgerLiveAppEthereumSigner.md#signtransaction)
- [isSigner](LedgerLiveAppEthereumSigner.md#issigner)

## Constructors

### constructor

• **new LedgerLiveAppEthereumSigner**(`provider`, `windowMessageTransport?`, `walletApiClient?`): [`LedgerLiveAppEthereumSigner`](LedgerLiveAppEthereumSigner.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `provider` | `Provider` |
| `windowMessageTransport?` | `default` |
| `walletApiClient?` | `WalletAPIClient`\<`CustomModule`, (`client`: `WalletAPIClient`\<`CustomModule`, (client: WalletAPIClient\<CustomModule, ...\>) =\> CustomModule \| Record\<string, CustomModule\>\>) => `CustomModule` \| `Record`\<`string`, `CustomModule`\>\> |

#### Returns

[`LedgerLiveAppEthereumSigner`](LedgerLiveAppEthereumSigner.md)

#### Overrides

Signer.constructor

#### Defined in

[src/lib/utils/ledger.ts:24](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L24)

## Properties

### \_account

• `Private` **\_account**: `undefined` \| `Account`

#### Defined in

[src/lib/utils/ledger.ts:22](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L22)

___

### \_isSigner

• `Readonly` **\_isSigner**: `boolean`

#### Inherited from

Signer.\_isSigner

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:29

___

### \_walletApiClient

• `Private` **\_walletApiClient**: `WalletAPIClient`\<`CustomModule`, (`client`: `WalletAPIClient`\<`CustomModule`, (client: WalletAPIClient\<CustomModule, ...\>) =\> CustomModule \| Record\<string, CustomModule\>\>) => `CustomModule` \| `Record`\<`string`, `CustomModule`\>\>

#### Defined in

[src/lib/utils/ledger.ts:20](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L20)

___

### \_windowMessageTransport

• `Private` **\_windowMessageTransport**: `default`

#### Defined in

[src/lib/utils/ledger.ts:21](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L21)

___

### provider

• `Optional` `Readonly` **provider**: `Provider`

#### Inherited from

Signer.provider

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:24

## Accessors

### account

• `get` **account**(): `undefined` \| `Account`

#### Returns

`undefined` \| `Account`

#### Defined in

[src/lib/utils/ledger.ts:37](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L37)

## Methods

### \_checkProvider

▸ **_checkProvider**(`operation?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `operation?` | `string` |

#### Returns

`void`

#### Inherited from

Signer.\_checkProvider

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:42

___

### call

▸ **call**(`transaction`, `blockTag?`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `Deferrable`\<`TransactionRequest`\> |
| `blockTag?` | `BlockTag` |

#### Returns

`Promise`\<`string`\>

#### Inherited from

Signer.call

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:34

___

### checkTransaction

▸ **checkTransaction**(`transaction`): `Deferrable`\<`TransactionRequest`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `Deferrable`\<`TransactionRequest`\> |

#### Returns

`Deferrable`\<`TransactionRequest`\>

#### Inherited from

Signer.checkTransaction

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:40

___

### connect

▸ **connect**(`provider`): `Signer`

#### Parameters

| Name | Type |
| :------ | :------ |
| `provider` | `Provider` |

#### Returns

`Signer`

#### Overrides

Signer.connect

#### Defined in

[src/lib/utils/ledger.ts:162](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L162)

___

### estimateGas

▸ **estimateGas**(`transaction`): `Promise`\<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `Deferrable`\<`TransactionRequest`\> |

#### Returns

`Promise`\<`BigNumber`\>

#### Inherited from

Signer.estimateGas

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:33

___

### getAccountId

▸ **getAccountId**(): `string`

#### Returns

`string`

#### Defined in

[src/lib/utils/ledger.ts:55](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L55)

___

### getAddress

▸ **getAddress**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Overrides

Signer.getAddress

#### Defined in

[src/lib/utils/ledger.ts:62](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L62)

___

### getBalance

▸ **getBalance**(`blockTag?`): `Promise`\<`BigNumber`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `blockTag?` | `BlockTag` |

#### Returns

`Promise`\<`BigNumber`\>

#### Inherited from

Signer.getBalance

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:31

___

### getChainId

▸ **getChainId**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Inherited from

Signer.getChainId

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:36

___

### getFeeData

▸ **getFeeData**(): `Promise`\<`FeeData`\>

#### Returns

`Promise`\<`FeeData`\>

#### Inherited from

Signer.getFeeData

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:38

___

### getGasPrice

▸ **getGasPrice**(): `Promise`\<`BigNumber`\>

#### Returns

`Promise`\<`BigNumber`\>

#### Inherited from

Signer.getGasPrice

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:37

___

### getTransactionCount

▸ **getTransactionCount**(`blockTag?`): `Promise`\<`number`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `blockTag?` | `BlockTag` |

#### Returns

`Promise`\<`number`\>

#### Inherited from

Signer.getTransactionCount

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:32

___

### populateTransaction

▸ **populateTransaction**(`transaction`): `Promise`\<`TransactionRequest`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `Deferrable`\<`TransactionRequest`\> |

#### Returns

`Promise`\<`TransactionRequest`\>

#### Inherited from

Signer.populateTransaction

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:41

___

### requestAccount

▸ **requestAccount**(`params`): `Promise`\<`Account`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | `undefined` \| \{ `currencyIds?`: `string`[]  } |

#### Returns

`Promise`\<`Account`\>

#### Defined in

[src/lib/utils/ledger.ts:45](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L45)

___

### resolveName

▸ **resolveName**(`name`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`Promise`\<`string`\>

#### Inherited from

Signer.resolveName

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:39

___

### sendTransaction

▸ **sendTransaction**(`transaction`): `Promise`\<`TransactionResponse`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `Deferrable`\<`TransactionRequest`\> |

#### Returns

`Promise`\<`TransactionResponse`\>

#### Overrides

Signer.sendTransaction

#### Defined in

[src/lib/utils/ledger.ts:117](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L117)

___

### setAccount

▸ **setAccount**(`account`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `account` | `undefined` \| `Account` |

#### Returns

`void`

#### Defined in

[src/lib/utils/ledger.ts:41](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L41)

___

### signMessage

▸ **signMessage**(`message`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `message` | `string` |

#### Returns

`Promise`\<`string`\>

#### Overrides

Signer.signMessage

#### Defined in

[src/lib/utils/ledger.ts:69](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L69)

___

### signTransaction

▸ **signTransaction**(`transaction`): `Promise`\<`string`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `TransactionRequest` |

#### Returns

`Promise`\<`string`\>

#### Overrides

Signer.signTransaction

#### Defined in

[src/lib/utils/ledger.ts:82](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L82)

___

### isSigner

▸ **isSigner**(`value`): value is Signer

#### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `any` |

#### Returns

value is Signer

#### Inherited from

Signer.isSigner

#### Defined in

node_modules/@ethersproject/contracts/node_modules/@ethersproject/abstract-signer/lib/index.d.ts:43
