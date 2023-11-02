@keep-network/tbtc-v2.ts

# @keep-network/tbtc-v2.ts

## Table of contents

### Namespaces

- [BitcoinNetwork](modules/BitcoinNetwork.md)
- [GetChainEvents](modules/GetChainEvents.md)
- [WalletState](modules/WalletState.md)

### Enumerations

- [BitcoinNetwork](enums/BitcoinNetwork-1.md)
- [WalletState](enums/WalletState-1.md)

### Classes

- [BitcoinTxHash](classes/BitcoinTxHash.md)
- [Deposit](classes/Deposit.md)
- [DepositFunding](classes/DepositFunding.md)
- [DepositRefund](classes/DepositRefund.md)
- [DepositScript](classes/DepositScript.md)
- [DepositsService](classes/DepositsService.md)
- [ElectrumClient](classes/ElectrumClient.md)
- [EthereumAddress](classes/EthereumAddress.md)
- [EthereumBridge](classes/EthereumBridge.md)
- [EthereumTBTCToken](classes/EthereumTBTCToken.md)
- [EthereumTBTCVault](classes/EthereumTBTCVault.md)
- [EthereumWalletRegistry](classes/EthereumWalletRegistry.md)
- [Hex](classes/Hex.md)
- [MaintenanceService](classes/MaintenanceService.md)
- [OptimisticMinting](classes/OptimisticMinting.md)
- [RedemptionsService](classes/RedemptionsService.md)
- [Spv](classes/Spv.md)
- [TBTC](classes/TBTC.md)
- [WalletTx](classes/WalletTx.md)

### Interfaces

- [BitcoinClient](interfaces/BitcoinClient.md)
- [BitcoinHeader](interfaces/BitcoinHeader.md)
- [BitcoinRawTx](interfaces/BitcoinRawTx.md)
- [BitcoinRawTxVectors](interfaces/BitcoinRawTxVectors.md)
- [BitcoinSpvProof](interfaces/BitcoinSpvProof.md)
- [BitcoinTx](interfaces/BitcoinTx.md)
- [BitcoinTxMerkleBranch](interfaces/BitcoinTxMerkleBranch.md)
- [BitcoinTxOutpoint](interfaces/BitcoinTxOutpoint.md)
- [BitcoinTxOutput](interfaces/BitcoinTxOutput.md)
- [Bridge](interfaces/Bridge.md)
- [ChainEvent](interfaces/ChainEvent.md)
- [ChainIdentifier](interfaces/ChainIdentifier.md)
- [DepositReceipt](interfaces/DepositReceipt.md)
- [DepositRequest](interfaces/DepositRequest.md)
- [ElectrumCredentials](interfaces/ElectrumCredentials.md)
- [EthereumContractConfig](interfaces/EthereumContractConfig.md)
- [RedemptionRequest](interfaces/RedemptionRequest.md)
- [TBTCToken](interfaces/TBTCToken.md)
- [TBTCVault](interfaces/TBTCVault.md)
- [Wallet](interfaces/Wallet.md)
- [WalletRegistry](interfaces/WalletRegistry.md)

### Type Aliases

- [BitcoinTxInput](README.md#bitcointxinput)
- [BitcoinUtxo](README.md#bitcoinutxo)
- [DepositRevealedEvent](README.md#depositrevealedevent)
- [DkgResultApprovedEvent](README.md#dkgresultapprovedevent)
- [DkgResultChallengedEvent](README.md#dkgresultchallengedevent)
- [DkgResultSubmittedEvent](README.md#dkgresultsubmittedevent)
- [ElectrumClientOptions](README.md#electrumclientoptions)
- [ErrorMatcherFn](README.md#errormatcherfn)
- [EthereumNetwork](README.md#ethereumnetwork)
- [EthereumSigner](README.md#ethereumsigner)
- [ExecutionLoggerFn](README.md#executionloggerfn)
- [NewWalletRegisteredEvent](README.md#newwalletregisteredevent)
- [OptimisticMintingCancelledEvent](README.md#optimisticmintingcancelledevent)
- [OptimisticMintingFinalizedEvent](README.md#optimisticmintingfinalizedevent)
- [OptimisticMintingRequest](README.md#optimisticmintingrequest)
- [OptimisticMintingRequestedEvent](README.md#optimisticmintingrequestedevent)
- [RedemptionRequestedEvent](README.md#redemptionrequestedevent)
- [RetrierFn](README.md#retrierfn)
- [TBTCContracts](README.md#tbtccontracts)

### Variables

- [BitcoinAddressConverter](README.md#bitcoinaddressconverter)
- [BitcoinCompactSizeUint](README.md#bitcoincompactsizeuint)
- [BitcoinHashUtils](README.md#bitcoinhashutils)
- [BitcoinHeaderSerializer](README.md#bitcoinheaderserializer)
- [BitcoinLocktimeUtils](README.md#bitcoinlocktimeutils)
- [BitcoinPrivateKeyUtils](README.md#bitcoinprivatekeyutils)
- [BitcoinPublicKeyUtils](README.md#bitcoinpublickeyutils)
- [BitcoinScriptUtils](README.md#bitcoinscriptutils)
- [BitcoinTargetConverter](README.md#bitcointargetconverter)

### Functions

- [assembleBitcoinSpvProof](README.md#assemblebitcoinspvproof)
- [backoffRetrier](README.md#backoffretrier)
- [computeElectrumScriptHash](README.md#computeelectrumscripthash)
- [ethereumAddressFromSigner](README.md#ethereumaddressfromsigner)
- [ethereumNetworkFromSigner](README.md#ethereumnetworkfromsigner)
- [extractBitcoinRawTxVectors](README.md#extractbitcoinrawtxvectors)
- [loadEthereumContracts](README.md#loadethereumcontracts)
- [retryAll](README.md#retryall)
- [skipRetryWhenMatched](README.md#skipretrywhenmatched)
- [toBitcoinJsLibNetwork](README.md#tobitcoinjslibnetwork)
- [validateBitcoinHeadersChain](README.md#validatebitcoinheaderschain)
- [validateBitcoinSpvProof](README.md#validatebitcoinspvproof)
- [validateDepositReceipt](README.md#validatedepositreceipt)

## Type Aliases

### BitcoinTxInput

Ƭ **BitcoinTxInput**: [`BitcoinTxOutpoint`](interfaces/BitcoinTxOutpoint.md) & \{ `scriptSig`: [`Hex`](classes/Hex.md)  }

Data about a Bitcoin transaction input.

#### Defined in

[lib/bitcoin/tx.ts:63](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/tx.ts#L63)

___

### BitcoinUtxo

Ƭ **BitcoinUtxo**: [`BitcoinTxOutpoint`](interfaces/BitcoinTxOutpoint.md) & \{ `value`: `BigNumber`  }

Data about a Bitcoin unspent transaction output.

#### Defined in

[lib/bitcoin/tx.ts:93](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/tx.ts#L93)

___

### DepositRevealedEvent

Ƭ **DepositRevealedEvent**: [`DepositReceipt`](interfaces/DepositReceipt.md) & `Pick`\<[`DepositRequest`](interfaces/DepositRequest.md), ``"amount"`` \| ``"vault"``\> & \{ `fundingOutputIndex`: `number` ; `fundingTxHash`: [`BitcoinTxHash`](classes/BitcoinTxHash.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event emitted on deposit reveal to the on-chain bridge.

#### Defined in

[lib/contracts/bridge.ts:283](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/bridge.ts#L283)

___

### DkgResultApprovedEvent

Ƭ **DkgResultApprovedEvent**: \{ `approver`: [`ChainIdentifier`](interfaces/ChainIdentifier.md) ; `resultHash`: [`Hex`](classes/Hex.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event emitted when a DKG result is approved on the on-chain
wallet registry.

#### Defined in

[lib/contracts/wallet-registry.ts:64](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/wallet-registry.ts#L64)

___

### DkgResultChallengedEvent

Ƭ **DkgResultChallengedEvent**: \{ `challenger`: [`ChainIdentifier`](interfaces/ChainIdentifier.md) ; `reason`: `string` ; `resultHash`: [`Hex`](classes/Hex.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event emitted when a DKG result is challenged on the on-chain
wallet registry.

#### Defined in

[lib/contracts/wallet-registry.ts:79](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/wallet-registry.ts#L79)

___

### DkgResultSubmittedEvent

Ƭ **DkgResultSubmittedEvent**: \{ `result`: `DkgResult` ; `resultHash`: [`Hex`](classes/Hex.md) ; `seed`: [`Hex`](classes/Hex.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event emitted when a DKG result is submitted to the on-chain
wallet registry.

#### Defined in

[lib/contracts/wallet-registry.ts:45](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/wallet-registry.ts#L45)

___

### ElectrumClientOptions

Ƭ **ElectrumClientOptions**: `object`

Additional options used by the Electrum server.

#### Defined in

[lib/electrum/client.ts:48](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L48)

___

### ErrorMatcherFn

Ƭ **ErrorMatcherFn**: (`err`: `unknown`) => `boolean`

#### Type declaration

▸ (`err`): `boolean`

##### Parameters

| Name | Type |
| :------ | :------ |
| `err` | `unknown` |

##### Returns

`boolean`

True if the error matches, false otherwise.

#### Defined in

[lib/utils/backoff.ts:42](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/utils/backoff.ts#L42)

___

### EthereumNetwork

Ƭ **EthereumNetwork**: ``"local"`` \| ``"goerli"`` \| ``"mainnet"``

Supported Ethereum networks.

#### Defined in

[lib/ethereum/index.ts:74](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/ethereum/index.ts#L74)

___

### EthereumSigner

Ƭ **EthereumSigner**: `Signer` \| `providers.Provider`

Represents an Ethereum signer. This type is a wrapper for Ethers-specific
types and can be either a Signer that can make write transactions
or a Provider that works only in the read-only mode.

#### Defined in

[lib/ethereum/index.ts:25](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/ethereum/index.ts#L25)

___

### ExecutionLoggerFn

Ƭ **ExecutionLoggerFn**: (`msg`: `string`) => `void`

#### Type declaration

▸ (`msg`): `void`

A function that is called with execution status messages.

##### Parameters

| Name | Type |
| :------ | :------ |
| `msg` | `string` |

##### Returns

`void`

#### Defined in

[lib/utils/backoff.ts:56](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/utils/backoff.ts#L56)

___

### NewWalletRegisteredEvent

Ƭ **NewWalletRegisteredEvent**: \{ `ecdsaWalletID`: [`Hex`](classes/Hex.md) ; `walletPublicKeyHash`: [`Hex`](classes/Hex.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event emitted when new wallet is registered on the on-chain bridge.

#### Defined in

[lib/contracts/bridge.ts:445](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/bridge.ts#L445)

___

### OptimisticMintingCancelledEvent

Ƭ **OptimisticMintingCancelledEvent**: \{ `depositKey`: [`Hex`](classes/Hex.md) ; `guardian`: [`ChainIdentifier`](interfaces/ChainIdentifier.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event that is emitted when an optimistic minting request
is cancelled on chain.

#### Defined in

[lib/contracts/tbtc-vault.ts:170](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/tbtc-vault.ts#L170)

___

### OptimisticMintingFinalizedEvent

Ƭ **OptimisticMintingFinalizedEvent**: \{ `depositKey`: [`Hex`](classes/Hex.md) ; `depositor`: [`ChainIdentifier`](interfaces/ChainIdentifier.md) ; `minter`: [`ChainIdentifier`](interfaces/ChainIdentifier.md) ; `optimisticMintingDebt`: `BigNumber`  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event that is emitted when an optimistic minting request
is finalized on chain.

#### Defined in

[lib/contracts/tbtc-vault.ts:186](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/tbtc-vault.ts#L186)

___

### OptimisticMintingRequest

Ƭ **OptimisticMintingRequest**: `Object`

Represents optimistic minting request for the given deposit revealed to the
Bridge.

#### Type declaration

| Name | Type | Description |
| :------ | :------ | :------ |
| `finalizedAt` | `number` | UNIX timestamp at which the optimistic minting was finalized. 0 if not yet finalized. |
| `requestedAt` | `number` | UNIX timestamp at which the optimistic minting was requested. |

#### Defined in

[lib/contracts/tbtc-vault.ts:120](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/tbtc-vault.ts#L120)

___

### OptimisticMintingRequestedEvent

Ƭ **OptimisticMintingRequestedEvent**: \{ `amount`: `BigNumber` ; `depositKey`: [`Hex`](classes/Hex.md) ; `depositor`: [`ChainIdentifier`](interfaces/ChainIdentifier.md) ; `fundingOutputIndex`: `number` ; `fundingTxHash`: [`BitcoinTxHash`](classes/BitcoinTxHash.md) ; `minter`: [`ChainIdentifier`](interfaces/ChainIdentifier.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event that is emitted when a new optimistic minting is requested
on chain.

#### Defined in

[lib/contracts/tbtc-vault.ts:136](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/tbtc-vault.ts#L136)

___

### RedemptionRequestedEvent

Ƭ **RedemptionRequestedEvent**: `Omit`\<[`RedemptionRequest`](interfaces/RedemptionRequest.md), ``"requestedAt"``\> & \{ `walletPublicKeyHash`: [`Hex`](classes/Hex.md)  } & [`ChainEvent`](interfaces/ChainEvent.md)

Represents an event emitted on redemption request.

#### Defined in

[lib/contracts/bridge.ts:334](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/bridge.ts#L334)

___

### RetrierFn

Ƭ **RetrierFn**\<`T`\>: (`fn`: () => `Promise`\<`T`\>) => `Promise`\<`T`\>

#### Type parameters

| Name |
| :------ |
| `T` |

#### Type declaration

▸ (`fn`): `Promise`\<`T`\>

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `fn` | () => `Promise`\<`T`\> | The function to be retried. |

##### Returns

`Promise`\<`T`\>

#### Defined in

[lib/utils/backoff.ts:51](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/utils/backoff.ts#L51)

___

### TBTCContracts

Ƭ **TBTCContracts**: `Object`

Convenience type aggregating all TBTC contracts handles.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `bridge` | [`Bridge`](interfaces/Bridge.md) |
| `tbtcToken` | [`TBTCToken`](interfaces/TBTCToken.md) |
| `tbtcVault` | [`TBTCVault`](interfaces/TBTCVault.md) |
| `walletRegistry` | [`WalletRegistry`](interfaces/WalletRegistry.md) |

#### Defined in

[lib/contracts/index.ts:16](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/index.ts#L16)

## Variables

### BitcoinAddressConverter

• `Const` **BitcoinAddressConverter**: `Object`

Utility functions allowing to perform Bitcoin address conversions.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `addressToOutputScript` | (`address`: `string`, `bitcoinNetwork`: [`BitcoinNetwork`](enums/BitcoinNetwork-1.md)) => [`Hex`](classes/Hex.md) |
| `addressToPublicKeyHash` | (`address`: `string`, `bitcoinNetwork`: [`BitcoinNetwork`](enums/BitcoinNetwork-1.md)) => [`Hex`](classes/Hex.md) |
| `outputScriptToAddress` | (`script`: [`Hex`](classes/Hex.md), `bitcoinNetwork`: [`BitcoinNetwork`](enums/BitcoinNetwork-1.md)) => `string` |
| `publicKeyHashToAddress` | (`publicKeyHash`: [`Hex`](classes/Hex.md), `witness`: `boolean`, `bitcoinNetwork`: [`BitcoinNetwork`](enums/BitcoinNetwork-1.md)) => `string` |
| `publicKeyToAddress` | (`publicKey`: [`Hex`](classes/Hex.md), `bitcoinNetwork`: [`BitcoinNetwork`](enums/BitcoinNetwork-1.md), `witness`: `boolean`) => `string` |

#### Defined in

[lib/bitcoin/address.ts:112](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/address.ts#L112)

___

### BitcoinCompactSizeUint

• `Const` **BitcoinCompactSizeUint**: `Object`

Utility functions allowing to deal with Bitcoin compact size uints.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `read` | (`varLenData`: [`Hex`](classes/Hex.md)) => \{ `byteLength`: `number` ; `value`: `number`  } |

#### Defined in

[lib/bitcoin/csuint.ts:50](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/csuint.ts#L50)

___

### BitcoinHashUtils

• `Const` **BitcoinHashUtils**: `Object`

Utility functions allowing to deal with Bitcoin hashes.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `computeHash160` | (`text`: [`Hex`](classes/Hex.md)) => [`Hex`](classes/Hex.md) |
| `computeHash256` | (`text`: [`Hex`](classes/Hex.md)) => [`Hex`](classes/Hex.md) |
| `computeSha256` | (`text`: [`Hex`](classes/Hex.md)) => [`Hex`](classes/Hex.md) |
| `hashLEToBigNumber` | (`hash`: [`Hex`](classes/Hex.md)) => `BigNumber` |

#### Defined in

[lib/bitcoin/hash.ts:52](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/hash.ts#L52)

___

### BitcoinHeaderSerializer

• `Const` **BitcoinHeaderSerializer**: `Object`

Utility functions allowing to serialize and deserialize Bitcoin block headers.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deserializeHeader` | (`rawHeader`: [`Hex`](classes/Hex.md)) => [`BitcoinHeader`](interfaces/BitcoinHeader.md) |
| `deserializeHeadersChain` | (`rawHeadersChain`: [`Hex`](classes/Hex.md)) => [`BitcoinHeader`](interfaces/BitcoinHeader.md)[] |
| `serializeHeader` | (`header`: [`BitcoinHeader`](interfaces/BitcoinHeader.md)) => [`Hex`](classes/Hex.md) |

#### Defined in

[lib/bitcoin/header.ts:109](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/header.ts#L109)

___

### BitcoinLocktimeUtils

• `Const` **BitcoinLocktimeUtils**: `Object`

Utility functions allowing to deal with Bitcoin locktime.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `calculateLocktime` | (`locktimeStartedAt`: `number`, `locktimeDuration`: `number`) => [`Hex`](classes/Hex.md) |
| `locktimeToNumber` | (`locktimeLE`: `string` \| `Buffer`) => `number` |

#### Defined in

[lib/bitcoin/tx.ts:234](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/tx.ts#L234)

___

### BitcoinPrivateKeyUtils

• `Const` **BitcoinPrivateKeyUtils**: `Object`

Utility functions allowing to perform operations on Bitcoin ECDSA private keys.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `createKeyPair` | (`privateKey`: `string`, `bitcoinNetwork`: [`BitcoinNetwork`](enums/BitcoinNetwork-1.md)) => `ECPairInterface` |

#### Defined in

[lib/bitcoin/ecdsa-key.ts:77](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/ecdsa-key.ts#L77)

___

### BitcoinPublicKeyUtils

• `Const` **BitcoinPublicKeyUtils**: `Object`

Utility functions allowing to perform operations on Bitcoin ECDSA public keys.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `compressPublicKey` | (`publicKey`: [`Hex`](classes/Hex.md)) => `string` |
| `isCompressedPublicKey` | (`publicKey`: [`Hex`](classes/Hex.md)) => `boolean` |

#### Defined in

[lib/bitcoin/ecdsa-key.ts:51](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/ecdsa-key.ts#L51)

___

### BitcoinScriptUtils

• `Const` **BitcoinScriptUtils**: `Object`

Utility functions allowing to deal with Bitcoin scripts.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `isP2PKHScript` | (`script`: [`Hex`](classes/Hex.md)) => `boolean` |
| `isP2SHScript` | (`script`: [`Hex`](classes/Hex.md)) => `boolean` |
| `isP2WPKHScript` | (`script`: [`Hex`](classes/Hex.md)) => `boolean` |
| `isP2WSHScript` | (`script`: [`Hex`](classes/Hex.md)) => `boolean` |

#### Defined in

[lib/bitcoin/script.ts:63](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/script.ts#L63)

___

### BitcoinTargetConverter

• `Const` **BitcoinTargetConverter**: `Object`

Utility functions allowing to perform Bitcoin target conversions.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `bitsToTarget` | (`bits`: `number`) => `BigNumber` |
| `targetToDifficulty` | (`target`: `BigNumber`) => `BigNumber` |

#### Defined in

[lib/bitcoin/header.ts:268](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/header.ts#L268)

## Functions

### assembleBitcoinSpvProof

▸ **assembleBitcoinSpvProof**(`transactionHash`, `requiredConfirmations`, `bitcoinClient`): `Promise`\<[`BitcoinTx`](interfaces/BitcoinTx.md) & [`BitcoinSpvProof`](interfaces/BitcoinSpvProof.md)\>

Assembles a proof that a given transaction was included in the blockchain and
has accumulated the required number of confirmations.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transactionHash` | [`BitcoinTxHash`](classes/BitcoinTxHash.md) | Hash of the transaction being proven. |
| `requiredConfirmations` | `number` | Required number of confirmations. |
| `bitcoinClient` | [`BitcoinClient`](interfaces/BitcoinClient.md) | Bitcoin client used to interact with the network. |

#### Returns

`Promise`\<[`BitcoinTx`](interfaces/BitcoinTx.md) & [`BitcoinSpvProof`](interfaces/BitcoinSpvProof.md)\>

Bitcoin transaction along with the inclusion proof.

#### Defined in

[lib/bitcoin/spv.ts:64](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/spv.ts#L64)

___

### backoffRetrier

▸ **backoffRetrier**\<`T`\>(`retries`, `backoffStepMs?`, `logger?`, `errorMatcher?`): [`RetrierFn`](README.md#retrierfn)\<`T`\>

Returns a retrier that can be passed a function to be retried `retries`
number of times, with exponential backoff. The result will return the
function's return value if no exceptions are thrown. It will only retry if
the function throws an exception matched by `matcher`; {@see retryAll} can
be used to retry no matter the exception, though this is not necessarily
recommended in production.

Example usage:

     await url.get("https://example.com/") // may transiently fail
     // Retries 3 times with exponential backoff, no matter what error is
     // reported by `url.get`.
     backoffRetrier(3)(async () => url.get("https://example.com"))
     // Retries 3 times with exponential backoff, but only if the error
     // message includes "server unavailable".
     backoffRetrier(3, (_) => _.message.includes('server unavailable'))(
       async () => url.get("https://example.com"))
     )

#### Type parameters

| Name |
| :------ |
| `T` |

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `retries` | `number` | `undefined` | The number of retries to perform before bubbling the failure out. |
| `backoffStepMs` | `number` | `1000` | Initial backoff step in milliseconds that will be increased exponentially for subsequent retry attempts. (default = 1000 ms) |
| `logger` | [`ExecutionLoggerFn`](README.md#executionloggerfn) | `console.debug` | A logger function to pass execution messages. |
| `errorMatcher?` | [`ErrorMatcherFn`](README.md#errormatcherfn) | `retryAll` | A matcher function that receives the error when an exception is thrown, and returns true if the error should lead to a retry. A false return will rethrow the error and terminate the retry loop. |

#### Returns

[`RetrierFn`](README.md#retrierfn)\<`T`\>

A function that can retry any function.

#### Defined in

[lib/utils/backoff.ts:89](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/utils/backoff.ts#L89)

___

### computeElectrumScriptHash

▸ **computeElectrumScriptHash**(`script`): `string`

Converts a Bitcoin script to an Electrum script hash. See
[Electrum protocol][https://electrumx.readthedocs.io/en/stable/protocol-basics.html#script-hashes](https://electrumx.readthedocs.io/en/stable/protocol-basics.html#script-hashes)

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `script` | [`Hex`](classes/Hex.md) | Bitcoin script as hex string |

#### Returns

`string`

Electrum script hash as a hex string.

#### Defined in

[lib/electrum/client.ts:591](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/electrum/client.ts#L591)

___

### ethereumAddressFromSigner

▸ **ethereumAddressFromSigner**(`signer`): `Promise`\<[`EthereumAddress`](classes/EthereumAddress.md) \| `undefined`\>

Resolves the Ethereum address tied to the given signer. The address
cannot be resolved for signers that works in the read-only mode

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `signer` | [`EthereumSigner`](README.md#ethereumsigner) | The signer whose address should be resolved. |

#### Returns

`Promise`\<[`EthereumAddress`](classes/EthereumAddress.md) \| `undefined`\>

Ethereum address or undefined for read-only signers.

**`Throws`**

Throws an error if the address of the signer is not a proper
        Ethereum address.

#### Defined in

[lib/ethereum/index.ts:61](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/ethereum/index.ts#L61)

___

### ethereumNetworkFromSigner

▸ **ethereumNetworkFromSigner**(`signer`): `Promise`\<[`EthereumNetwork`](README.md#ethereumnetwork)\>

Resolves the Ethereum network the given signer is tied to.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `signer` | [`EthereumSigner`](README.md#ethereumsigner) | The signer whose network should be resolved. |

#### Returns

`Promise`\<[`EthereumNetwork`](README.md#ethereumnetwork)\>

Ethereum network.

#### Defined in

[lib/ethereum/index.ts:32](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/ethereum/index.ts#L32)

___

### extractBitcoinRawTxVectors

▸ **extractBitcoinRawTxVectors**(`rawTransaction`): [`BitcoinRawTxVectors`](interfaces/BitcoinRawTxVectors.md)

Decomposes a transaction in the raw representation into version, vector of
inputs, vector of outputs and locktime.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `rawTransaction` | [`BitcoinRawTx`](interfaces/BitcoinRawTx.md) | Transaction in the raw format. |

#### Returns

[`BitcoinRawTxVectors`](interfaces/BitcoinRawTxVectors.md)

Transaction data with fields represented as un-prefixed hex strings.

#### Defined in

[lib/bitcoin/tx.ts:133](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/tx.ts#L133)

___

### loadEthereumContracts

▸ **loadEthereumContracts**(`signer`, `network`): `Promise`\<[`TBTCContracts`](README.md#tbtccontracts)\>

Loads Ethereum implementation of tBTC contracts for the given Ethereum
network and attaches the given signer there.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `signer` | [`EthereumSigner`](README.md#ethereumsigner) | Signer that should be attached to tBTC contracts. |
| `network` | [`EthereumNetwork`](README.md#ethereumnetwork) | Ethereum network. |

#### Returns

`Promise`\<[`TBTCContracts`](README.md#tbtccontracts)\>

Handle to tBTC contracts.

**`Throws`**

Throws an error if the signer's Ethereum network is other than
        the one used to load tBTC contracts.

#### Defined in

[lib/ethereum/index.ts:85](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/ethereum/index.ts#L85)

___

### retryAll

▸ **retryAll**(`error`): ``true``

A convenience matcher for withBackoffRetries that retries irrespective of
the error.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `error` | `any` | The error to match against. Not necessarily an Error instance, since the retriable function may throw a non-Error. |

#### Returns

``true``

Always returns true.

#### Defined in

[lib/utils/backoff.ts:9](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/utils/backoff.ts#L9)

___

### skipRetryWhenMatched

▸ **skipRetryWhenMatched**(`matchers`): [`ErrorMatcherFn`](README.md#errormatcherfn)

A matcher to specify list of error messages that should abort the retry loop
and throw immediately.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `matchers` | (`string` \| `RegExp`)[] | List of patterns for error matching. |

#### Returns

[`ErrorMatcherFn`](README.md#errormatcherfn)

Matcher function that returns false if error matches one of the patterns.
         True is returned if no matches are found and retry loop should continue

#### Defined in

[lib/utils/backoff.ts:20](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/utils/backoff.ts#L20)

___

### toBitcoinJsLibNetwork

▸ **toBitcoinJsLibNetwork**(`bitcoinNetwork`): `networks.Network`

Converts the provided [BitcoinNetwork](enums/BitcoinNetwork-1.md) enumeration to a format expected
by the `bitcoinjs-lib` library.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinNetwork` | [`BitcoinNetwork`](enums/BitcoinNetwork-1.md) | Specified Bitcoin network. |

#### Returns

`networks.Network`

Network representation compatible with the `bitcoinjs-lib` library.

**`Throws`**

An error if the network is not supported by `bitcoinjs-lib`.

#### Defined in

[lib/bitcoin/network.ts:55](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/network.ts#L55)

___

### validateBitcoinHeadersChain

▸ **validateBitcoinHeadersChain**(`headers`, `previousEpochDifficulty`, `currentEpochDifficulty`): `void`

Validates a chain of consecutive block headers by checking each header's
difficulty, hash, and continuity with the previous header. This function can
be used to validate a series of Bitcoin block headers for their validity.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `headers` | [`BitcoinHeader`](interfaces/BitcoinHeader.md)[] | An array of block headers that form the chain to be validated. |
| `previousEpochDifficulty` | `BigNumber` | The difficulty of the previous Bitcoin epoch. |
| `currentEpochDifficulty` | `BigNumber` | The difficulty of the current Bitcoin epoch. |

#### Returns

`void`

An empty return value.

**`Dev`**

The block headers must come from Bitcoin epochs with difficulties marked
     by the previous and current difficulties. If a Bitcoin difficulty relay
     is used to provide these values and the relay is up-to-date, only the
     recent block headers will pass validation. Block headers older than the
     current and previous Bitcoin epochs will fail.

**`Throws`**

If any of the block headers are invalid, or if the block
        header chain is not continuous.

#### Defined in

[lib/bitcoin/header.ts:132](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/header.ts#L132)

___

### validateBitcoinSpvProof

▸ **validateBitcoinSpvProof**(`transactionHash`, `requiredConfirmations`, `previousDifficulty`, `currentDifficulty`, `bitcoinClient`): `Promise`\<`void`\>

Proves that a transaction with the given hash is included in the Bitcoin
blockchain by validating the transaction's inclusion in the Merkle tree and
verifying that the block containing the transaction has enough confirmations.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transactionHash` | [`BitcoinTxHash`](classes/BitcoinTxHash.md) | The hash of the transaction to be validated. |
| `requiredConfirmations` | `number` | The number of confirmations required for the transaction to be considered valid. The transaction has 1 confirmation when it is in the block at the current blockchain tip. Every subsequent block added to the blockchain is one additional confirmation. |
| `previousDifficulty` | `BigNumber` | The difficulty of the previous Bitcoin epoch. |
| `currentDifficulty` | `BigNumber` | The difficulty of the current Bitcoin epoch. |
| `bitcoinClient` | [`BitcoinClient`](interfaces/BitcoinClient.md) | The client for interacting with the Bitcoin blockchain. |

#### Returns

`Promise`\<`void`\>

An empty return value.

**`Throws`**

If the transaction is not included in the Bitcoin blockchain
       or if the block containing the transaction does not have enough
       confirmations.

**`Dev`**

The function should be used within a try-catch block.

#### Defined in

[lib/bitcoin/spv.ts:145](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/bitcoin/spv.ts#L145)

___

### validateDepositReceipt

▸ **validateDepositReceipt**(`receipt`): `void`

Validates the given deposit receipt. Throws in case of a validation error.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `receipt` | [`DepositReceipt`](interfaces/DepositReceipt.md) | The validated deposit receipt. |

#### Returns

`void`

**`Dev`**

This function does not validate the depositor's identifier as its
     validity is chain-specific. This parameter must be validated outside.

#### Defined in

[lib/contracts/bridge.ts:228](https://github.com/keep-network/tbtc-v2/blob/80605fcc/typescript/src/lib/contracts/bridge.ts#L228)
