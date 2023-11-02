[@keep-network/tbtc-v2.ts](../README.md) / ElectrumClient

# Class: ElectrumClient

Electrum-based implementation of the Bitcoin client.

## Implements

- [`BitcoinClient`](../interfaces/BitcoinClient.md)

## Table of contents

### Constructors

- [constructor](ElectrumClient.md#constructor)

### Properties

- [connectionTimeout](ElectrumClient.md#connectiontimeout)
- [credentials](ElectrumClient.md#credentials)
- [options](ElectrumClient.md#options)
- [retryBackoffStep](ElectrumClient.md#retrybackoffstep)
- [totalRetryAttempts](ElectrumClient.md#totalretryattempts)

### Methods

- [broadcast](ElectrumClient.md#broadcast)
- [findAllUnspentTransactionOutputs](ElectrumClient.md#findallunspenttransactionoutputs)
- [getHeadersChain](ElectrumClient.md#getheaderschain)
- [getNetwork](ElectrumClient.md#getnetwork)
- [getRawTransaction](ElectrumClient.md#getrawtransaction)
- [getTransaction](ElectrumClient.md#gettransaction)
- [getTransactionConfirmations](ElectrumClient.md#gettransactionconfirmations)
- [getTransactionHistory](ElectrumClient.md#gettransactionhistory)
- [getTransactionMerkle](ElectrumClient.md#gettransactionmerkle)
- [latestBlockHeight](ElectrumClient.md#latestblockheight)
- [withBackoffRetrier](ElectrumClient.md#withbackoffretrier)
- [withElectrum](ElectrumClient.md#withelectrum)
- [fromDefaultConfig](ElectrumClient.md#fromdefaultconfig)
- [fromUrl](ElectrumClient.md#fromurl)
- [parseElectrumCredentials](ElectrumClient.md#parseelectrumcredentials)

## Constructors

### constructor

• **new ElectrumClient**(`credentials`, `options?`, `totalRetryAttempts?`, `retryBackoffStep?`, `connectionTimeout?`): [`ElectrumClient`](ElectrumClient.md)

#### Parameters

| Name | Type | Default value |
| :------ | :------ | :------ |
| `credentials` | [`ElectrumCredentials`](../interfaces/ElectrumCredentials.md)[] | `undefined` |
| `options?` | `object` | `undefined` |
| `totalRetryAttempts` | `number` | `3` |
| `retryBackoffStep` | `number` | `10000` |
| `connectionTimeout` | `number` | `20000` |

#### Returns

[`ElectrumClient`](ElectrumClient.md)

#### Defined in

[lib/electrum/client.ts:72](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L72)

## Properties

### connectionTimeout

• `Private` **connectionTimeout**: `number`

#### Defined in

[lib/electrum/client.ts:70](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L70)

___

### credentials

• `Private` **credentials**: [`ElectrumCredentials`](../interfaces/ElectrumCredentials.md)[]

#### Defined in

[lib/electrum/client.ts:66](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L66)

___

### options

• `Private` `Optional` **options**: `object`

#### Defined in

[lib/electrum/client.ts:67](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L67)

___

### retryBackoffStep

• `Private` **retryBackoffStep**: `number`

#### Defined in

[lib/electrum/client.ts:69](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L69)

___

### totalRetryAttempts

• `Private` **totalRetryAttempts**: `number`

#### Defined in

[lib/electrum/client.ts:68](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L68)

## Methods

### broadcast

▸ **broadcast**(`transaction`): `Promise`\<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transaction` | [`BitcoinRawTx`](../interfaces/BitcoinRawTx.md) |

#### Returns

`Promise`\<`void`\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[broadcast](../interfaces/BitcoinClient.md#broadcast)

#### Defined in

[lib/electrum/client.ts:574](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L574)

___

### findAllUnspentTransactionOutputs

▸ **findAllUnspentTransactionOutputs**(`address`): `Promise`\<[`BitcoinUtxo`](../README.md#bitcoinutxo)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | `string` |

#### Returns

`Promise`\<[`BitcoinUtxo`](../README.md#bitcoinutxo)[]\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[findAllUnspentTransactionOutputs](../interfaces/BitcoinClient.md#findallunspenttransactionoutputs)

#### Defined in

[lib/electrum/client.ts:260](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L260)

___

### getHeadersChain

▸ **getHeadersChain**(`blockHeight`, `chainLength`): `Promise`\<[`Hex`](Hex.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `blockHeight` | `number` |
| `chainLength` | `number` |

#### Returns

`Promise`\<[`Hex`](Hex.md)\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getHeadersChain](../interfaces/BitcoinClient.md#getheaderschain)

#### Defined in

[lib/electrum/client.ts:524](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L524)

___

### getNetwork

▸ **getNetwork**(): `Promise`\<[`BitcoinNetwork`](../enums/BitcoinNetwork-1.md)\>

#### Returns

`Promise`\<[`BitcoinNetwork`](../enums/BitcoinNetwork-1.md)\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getNetwork](../interfaces/BitcoinClient.md#getnetwork)

#### Defined in

[lib/electrum/client.ts:238](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L238)

___

### getRawTransaction

▸ **getRawTransaction**(`transactionHash`): `Promise`\<[`BitcoinRawTx`](../interfaces/BitcoinRawTx.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transactionHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |

#### Returns

`Promise`\<[`BitcoinRawTx`](../interfaces/BitcoinRawTx.md)\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getRawTransaction](../interfaces/BitcoinClient.md#getrawtransaction)

#### Defined in

[lib/electrum/client.ts:395](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L395)

___

### getTransaction

▸ **getTransaction**(`transactionHash`): `Promise`\<[`BitcoinTx`](../interfaces/BitcoinTx.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transactionHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |

#### Returns

`Promise`\<[`BitcoinTx`](../interfaces/BitcoinTx.md)\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getTransaction](../interfaces/BitcoinClient.md#gettransaction)

#### Defined in

[lib/electrum/client.ts:345](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L345)

___

### getTransactionConfirmations

▸ **getTransactionConfirmations**(`transactionHash`): `Promise`\<`number`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transactionHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |

#### Returns

`Promise`\<`number`\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getTransactionConfirmations](../interfaces/BitcoinClient.md#gettransactionconfirmations)

#### Defined in

[lib/electrum/client.ts:416](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L416)

___

### getTransactionHistory

▸ **getTransactionHistory**(`address`, `limit?`): `Promise`\<[`BitcoinTx`](../interfaces/BitcoinTx.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `address` | `string` |
| `limit?` | `number` |

#### Returns

`Promise`\<[`BitcoinTx`](../interfaces/BitcoinTx.md)[]\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getTransactionHistory](../interfaces/BitcoinClient.md#gettransactionhistory)

#### Defined in

[lib/electrum/client.ts:291](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L291)

___

### getTransactionMerkle

▸ **getTransactionMerkle**(`transactionHash`, `blockHeight`): `Promise`\<[`BitcoinTxMerkleBranch`](../interfaces/BitcoinTxMerkleBranch.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `transactionHash` | [`BitcoinTxHash`](BitcoinTxHash.md) |
| `blockHeight` | `number` |

#### Returns

`Promise`\<[`BitcoinTxMerkleBranch`](../interfaces/BitcoinTxMerkleBranch.md)\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[getTransactionMerkle](../interfaces/BitcoinClient.md#gettransactionmerkle)

#### Defined in

[lib/electrum/client.ts:543](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L543)

___

### latestBlockHeight

▸ **latestBlockHeight**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

**`See`**

#### Implementation of

[BitcoinClient](../interfaces/BitcoinClient.md).[latestBlockHeight](../interfaces/BitcoinClient.md#latestblockheight)

#### Defined in

[lib/electrum/client.ts:508](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L508)

___

### withBackoffRetrier

▸ **withBackoffRetrier**\<`T`\>(): [`RetrierFn`](../README.md#retrierfn)\<`T`\>

Initiates a backoff retrier.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Returns

[`RetrierFn`](../README.md#retrierfn)\<`T`\>

A function that can retry any function.

#### Defined in

[lib/electrum/client.ts:230](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L230)

___

### withElectrum

▸ **withElectrum**\<`T`\>(`action`): `Promise`\<`T`\>

Initiates an Electrum connection and uses it to feed the given action.
Closes the connection regardless of the action outcome.

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `action` | `ElectrumAction`\<`T`\> | Action that makes use of the Electrum connection. |

#### Returns

`Promise`\<`T`\>

Promise holding the outcome.

#### Defined in

[lib/electrum/client.ts:168](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L168)

___

### fromDefaultConfig

▸ **fromDefaultConfig**(`network`): [`ElectrumClient`](ElectrumClient.md)

Creates an Electrum client instance using a default config for the given
Bitcoin network.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `network` | [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md) | Bitcoin network the instance should be created for. |

#### Returns

[`ElectrumClient`](ElectrumClient.md)

Electrum client instance.

#### Defined in

[lib/electrum/client.ts:126](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L126)

___

### fromUrl

▸ **fromUrl**(`url`, `options?`, `totalRetryAttempts?`, `retryBackoffStep?`, `connectionTimeout?`): [`ElectrumClient`](ElectrumClient.md)

Creates an Electrum client instance from a URL.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `url` | `string` \| `string`[] | `undefined` | Connection URL or list of URLs. |
| `options?` | `object` | `undefined` | Additional options used by the Electrum server. |
| `totalRetryAttempts` | `number` | `3` | Number of retries for requests sent to Electrum server. |
| `retryBackoffStep` | `number` | `1000` | Initial backoff step in milliseconds that will be increased exponentially for subsequent retry attempts. |
| `connectionTimeout` | `number` | `20000` | Timeout for a single try of connection establishment. |

#### Returns

[`ElectrumClient`](ElectrumClient.md)

Electrum client instance.

#### Defined in

[lib/electrum/client.ts:97](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L97)

___

### parseElectrumCredentials

▸ **parseElectrumCredentials**(`url`): [`ElectrumCredentials`](../interfaces/ElectrumCredentials.md)

Create Electrum credentials by parsing an URL.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `url` | `string` | URL to be parsed. |

#### Returns

[`ElectrumCredentials`](../interfaces/ElectrumCredentials.md)

Electrum credentials object.

#### Defined in

[lib/electrum/client.ts:147](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L147)
