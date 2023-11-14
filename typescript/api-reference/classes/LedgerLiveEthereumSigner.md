# Class: LedgerLiveEthereumSigner

Ethereum signer extended from `ethers` Signer class. The main purpose of it
is to allow the user to communicate with eth contracts through our tBTC SDK
inside Ledger Live application, when the app is used there as a Live App.

## Hierarchy

- `Signer`

  ↳ **`LedgerLiveEthereumSigner`**

## Table of contents

### Constructors

- [constructor](LedgerLiveEthereumSigner.md#constructor)

### Properties

- [\_account](LedgerLiveEthereumSigner.md#_account)
- [\_isSigner](LedgerLiveEthereumSigner.md#_issigner)
- [\_walletApiClient](LedgerLiveEthereumSigner.md#_walletapiclient)
- [\_windowMessageTransport](LedgerLiveEthereumSigner.md#_windowmessagetransport)
- [provider](LedgerLiveEthereumSigner.md#provider)

### Accessors

- [account](LedgerLiveEthereumSigner.md#account)

### Methods

- [\_catchWalletApiError](LedgerLiveEthereumSigner.md#_catchwalletapierror)
- [\_checkAccount](LedgerLiveEthereumSigner.md#_checkaccount)
- [\_checkProvider](LedgerLiveEthereumSigner.md#_checkprovider)
- [\_checkProviderAndAccount](LedgerLiveEthereumSigner.md#_checkproviderandaccount)
- [\_getWalletApiEthereumTransaction](LedgerLiveEthereumSigner.md#_getwalletapiethereumtransaction)
- [call](LedgerLiveEthereumSigner.md#call)
- [checkTransaction](LedgerLiveEthereumSigner.md#checktransaction)
- [connect](LedgerLiveEthereumSigner.md#connect)
- [estimateGas](LedgerLiveEthereumSigner.md#estimategas)
- [getAccountId](LedgerLiveEthereumSigner.md#getaccountid)
- [getAddress](LedgerLiveEthereumSigner.md#getaddress)
- [getBalance](LedgerLiveEthereumSigner.md#getbalance)
- [getChainId](LedgerLiveEthereumSigner.md#getchainid)
- [getFeeData](LedgerLiveEthereumSigner.md#getfeedata)
- [getGasPrice](LedgerLiveEthereumSigner.md#getgasprice)
- [getTransactionCount](LedgerLiveEthereumSigner.md#gettransactioncount)
- [populateTransaction](LedgerLiveEthereumSigner.md#populatetransaction)
- [requestAccount](LedgerLiveEthereumSigner.md#requestaccount)
- [resolveName](LedgerLiveEthereumSigner.md#resolvename)
- [sendTransaction](LedgerLiveEthereumSigner.md#sendtransaction)
- [setAccount](LedgerLiveEthereumSigner.md#setaccount)
- [signMessage](LedgerLiveEthereumSigner.md#signmessage)
- [signTransaction](LedgerLiveEthereumSigner.md#signtransaction)
- [isSigner](LedgerLiveEthereumSigner.md#issigner)

## Constructors

### constructor

• **new LedgerLiveEthereumSigner**(`provider?`): [`LedgerLiveEthereumSigner`](LedgerLiveEthereumSigner.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `provider?` | `Provider` |

#### Returns

[`LedgerLiveEthereumSigner`](LedgerLiveEthereumSigner.md)

#### Overrides

Signer.constructor

#### Defined in

[src/lib/utils/ledger.ts:31](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L31)

## Properties

### \_account

• `Private` **\_account**: `undefined` \| `Account`

#### Defined in

[src/lib/utils/ledger.ts:29](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L29)

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

[src/lib/utils/ledger.ts:27](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L27)

___

### \_windowMessageTransport

• `Private` **\_windowMessageTransport**: `default`

#### Defined in

[src/lib/utils/ledger.ts:28](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L28)

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

[src/lib/utils/ledger.ts:61](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L61)

## Methods

### \_catchWalletApiError

▸ **_catchWalletApiError**(`error?`, `defaultErrorMessage?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `error?` | `any` |
| `defaultErrorMessage?` | `string` |

#### Returns

`void`

#### Defined in

[src/lib/utils/ledger.ts:49](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L49)

___

### \_checkAccount

▸ **_checkAccount**(): `void`

#### Returns

`void`

#### Defined in

[src/lib/utils/ledger.ts:38](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L38)

___

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

### \_checkProviderAndAccount

▸ **_checkProviderAndAccount**(): `void`

#### Returns

`void`

#### Defined in

[src/lib/utils/ledger.ts:44](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L44)

___

### \_getWalletApiEthereumTransaction

▸ **_getWalletApiEthereumTransaction**(`transaction`): `EthereumTransaction`

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | `TransactionRequest` |

#### Returns

`EthereumTransaction`

#### Defined in

[src/lib/utils/ledger.ts:98](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L98)

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

[src/lib/utils/ledger.ts:221](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L221)

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

[src/lib/utils/ledger.ts:88](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L88)

___

### getAddress

▸ **getAddress**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

#### Overrides

Signer.getAddress

#### Defined in

[src/lib/utils/ledger.ts:93](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L93)

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

[src/lib/utils/ledger.ts:69](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L69)

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

[src/lib/utils/ledger.ts:185](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L185)

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

[src/lib/utils/ledger.ts:65](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L65)

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

[src/lib/utils/ledger.ts:138](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L138)

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

[src/lib/utils/ledger.ts:159](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/utils/ledger.ts#L159)

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
