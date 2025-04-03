# Class: TBTC

Entrypoint component of the tBTC v2 SDK.

## Table of contents

### Constructors

- [constructor](TBTC.md#constructor)

### Properties

- [#crossChainContracts](TBTC.md##crosschaincontracts)
- [#crossChainContractsLoader](TBTC.md##crosschaincontractsloader)
- [bitcoinClient](TBTC.md#bitcoinclient)
- [deposits](TBTC.md#deposits)
- [maintenance](TBTC.md#maintenance)
- [redemptions](TBTC.md#redemptions)
- [tbtcContracts](TBTC.md#tbtccontracts)

### Methods

- [crossChainContracts](TBTC.md#crosschaincontracts)
- [initializeCrossChain](TBTC.md#initializecrosschain)
- [initializeCustom](TBTC.md#initializecustom)
- [initializeEthereum](TBTC.md#initializeethereum)
- [initializeMainnet](TBTC.md#initializemainnet)
- [initializeSepolia](TBTC.md#initializesepolia)

## Constructors

### constructor

• **new TBTC**(`tbtcContracts`, `bitcoinClient`, `crossChainContractsLoader?`): [`TBTC`](TBTC.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `tbtcContracts` | [`TBTCContracts`](../README.md#tbtccontracts) |
| `bitcoinClient` | [`BitcoinClient`](../interfaces/BitcoinClient.md) |
| `crossChainContractsLoader?` | [`CrossChainContractsLoader`](../interfaces/CrossChainContractsLoader.md) |

#### Returns

[`TBTC`](TBTC.md)

#### Defined in

[services/tbtc.ts:66](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L66)

## Properties

### #crossChainContracts

• `Private` `Readonly` **#crossChainContracts**: `Map`\<[`DestinationChainName`](../README.md#destinationchainname), [`CrossChainInterfaces`](../README.md#crosschaininterfaces)\>

Mapping of cross-chain contracts for different supported L2 chains.
Each set of cross-chain contracts must be first initialized using
the `initializeCrossChain` method.

#### Defined in

[services/tbtc.ts:64](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L64)

___

### #crossChainContractsLoader

• `Private` `Optional` `Readonly` **#crossChainContractsLoader**: [`CrossChainContractsLoader`](../interfaces/CrossChainContractsLoader.md)

Reference to the cross-chain contracts loader.

#### Defined in

[services/tbtc.ts:58](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L58)

___

### bitcoinClient

• `Readonly` **bitcoinClient**: [`BitcoinClient`](../interfaces/BitcoinClient.md)

Bitcoin client handle for low-level access.

#### Defined in

[services/tbtc.ts:54](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L54)

___

### deposits

• `Readonly` **deposits**: [`DepositsService`](DepositsService.md)

Service supporting the tBTC v2 deposit flow.

#### Defined in

[services/tbtc.ts:37](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L37)

___

### maintenance

• `Readonly` **maintenance**: [`MaintenanceService`](MaintenanceService.md)

Service supporting authorized operations of tBTC v2 system maintainers
and operators.

#### Defined in

[services/tbtc.ts:42](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L42)

___

### redemptions

• `Readonly` **redemptions**: [`RedemptionsService`](RedemptionsService.md)

Service supporting the tBTC v2 redemption flow.

#### Defined in

[services/tbtc.ts:46](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L46)

___

### tbtcContracts

• `Readonly` **tbtcContracts**: [`TBTCContracts`](../README.md#tbtccontracts)

Handle to tBTC contracts for low-level access.

#### Defined in

[services/tbtc.ts:50](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L50)

## Methods

### crossChainContracts

▸ **crossChainContracts**(`destinationChainName`): `undefined` \| [`CrossChainInterfaces`](../README.md#crosschaininterfaces)

Gets cross-chain contracts for the given supported L2 chain.
The given destination chain contracts must be first initialized using the
`initializeCrossChain` method.

 THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
              IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
              PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
              CROSS-CHAIN SUPPORT IS NOT FULLY OPERATIONAL YET.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `destinationChainName` | [`DestinationChainName`](../README.md#destinationchainname) | Name of the destination chain for which to get cross-chain contracts. |

#### Returns

`undefined` \| [`CrossChainInterfaces`](../README.md#crosschaininterfaces)

Cross-chain contracts for the given L2 chain or
         undefined if not initialized.

#### Defined in

[services/tbtc.ts:343](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L343)

___

### initializeCrossChain

▸ **initializeCrossChain**(`destinationChainName`, `ethereumChainSigner`, `solanaProvider?`, `suiClient?`, `suiSigner?`): `Promise`\<`void`\>

Initializes cross-chain contracts for the given L2 chain, using the
given signer. Updates the signer on subsequent calls.

 THIS IS EXPERIMENTAL CODE THAT CAN BE CHANGED OR REMOVED
              IN FUTURE RELEASES. IT SHOULD BE USED ONLY FOR INTERNAL
              PURPOSES AND EXTERNAL APPLICATIONS SHOULD NOT DEPEND ON IT.
              CROSS-CHAIN SUPPORT IS NOT FULLY OPERATIONAL YET.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `destinationChainName` | [`DestinationChainName`](../README.md#destinationchainname) | Name of the L2 chain for which to initialize cross-chain contracts. |
| `ethereumChainSigner` | [`EthereumSigner`](../README.md#ethereumsigner) | Signer to use with the L2 chain contracts. |
| `solanaProvider?` | `AnchorProvider` | Provider of Solana that contains connection and signer. |
| `suiClient?` | `SuiClient` | Client to interact with the SUI network. |
| `suiSigner?` | `Signer` | Signer for SUI transactions. |

#### Returns

`Promise`\<`void`\>

Void promise.

**`Throws`**

Throws an error if:
        - Cross-chain contracts loader is not available for this TBTC SDK instance,
        - Chain mapping between the L1 and the given L2 chain is not defined.

**`Dev`**

In case this function needs to support non-EVM L2 chains that can't
     use EthereumSigner as a signer type, the l2Signer parameter should
     probably be turned into a union of multiple supported types or
     generalized in some other way.

#### Defined in

[services/tbtc.ts:223](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L223)

___

### initializeCustom

▸ **initializeCustom**(`tbtcContracts`, `bitcoinClient`): `Promise`\<[`TBTC`](TBTC.md)\>

Initializes the tBTC v2 SDK entrypoint with custom tBTC contracts and
Bitcoin client.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tbtcContracts` | [`TBTCContracts`](../README.md#tbtccontracts) | Custom tBTC contracts handle. |
| `bitcoinClient` | [`BitcoinClient`](../interfaces/BitcoinClient.md) | Custom Bitcoin client implementation. |

#### Returns

`Promise`\<[`TBTC`](TBTC.md)\>

Initialized tBTC v2 SDK entrypoint.

**`Dev`**

This function is especially useful for local development as it gives
     flexibility to combine different implementations of tBTC v2 contracts
     with different Bitcoin networks.

#### Defined in

[services/tbtc.ts:192](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L192)

___

### initializeEthereum

▸ **initializeEthereum**(`ethereumSignerOrProvider`, `ethereumChainId`, `bitcoinNetwork`, `crossChainSupport?`): `Promise`\<[`TBTC`](TBTC.md)\>

Initializes the tBTC v2 SDK entrypoint for the given Ethereum network and Bitcoin network.
The initialized instance uses default Electrum servers to interact
with Bitcoin network.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `ethereumSignerOrProvider` | [`EthereumSigner`](../README.md#ethereumsigner) | `undefined` | Ethereum signer or provider. |
| `ethereumChainId` | [`Ethereum`](../enums/Chains.Ethereum.md) | `undefined` | Ethereum chain ID. |
| `bitcoinNetwork` | [`BitcoinNetwork`](../enums/BitcoinNetwork-1.md) | `undefined` | Bitcoin network. |
| `crossChainSupport` | `boolean` | `false` | Whether to enable cross-chain support. False by default. |

#### Returns

`Promise`\<[`TBTC`](TBTC.md)\>

Initialized tBTC v2 SDK entrypoint.

**`Throws`**

Throws an error if the underlying signer's Ethereum network is
        other than the given Ethereum network.

#### Defined in

[services/tbtc.ts:143](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L143)

___

### initializeMainnet

▸ **initializeMainnet**(`ethereumSignerOrProvider`, `crossChainSupport?`): `Promise`\<[`TBTC`](TBTC.md)\>

Initializes the tBTC v2 SDK entrypoint for Ethereum and Bitcoin mainnets.
The initialized instance uses default Electrum servers to interact
with Bitcoin mainnet

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `ethereumSignerOrProvider` | [`EthereumSigner`](../README.md#ethereumsigner) | `undefined` | Ethereum signer or provider. |
| `crossChainSupport` | `boolean` | `false` | Whether to enable cross-chain support. False by default. |

#### Returns

`Promise`\<[`TBTC`](TBTC.md)\>

Initialized tBTC v2 SDK entrypoint.

**`Throws`**

Throws an error if the signer's Ethereum network is other than
        Ethereum mainnet.

#### Defined in

[services/tbtc.ts:97](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L97)

___

### initializeSepolia

▸ **initializeSepolia**(`ethereumSignerOrProvider`, `crossChainSupport?`): `Promise`\<[`TBTC`](TBTC.md)\>

Initializes the tBTC v2 SDK entrypoint for Ethereum Sepolia and Bitcoin testnet.
The initialized instance uses default Electrum servers to interact
with Bitcoin testnet

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `ethereumSignerOrProvider` | [`EthereumSigner`](../README.md#ethereumsigner) | `undefined` | Ethereum signer or provider. |
| `crossChainSupport` | `boolean` | `false` | Whether to enable cross-chain support. False by default. |

#### Returns

`Promise`\<[`TBTC`](TBTC.md)\>

Initialized tBTC v2 SDK entrypoint.

**`Throws`**

Throws an error if the signer's Ethereum network is other than
        Ethereum mainnet.

#### Defined in

[services/tbtc.ts:119](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/tbtc.ts#L119)
