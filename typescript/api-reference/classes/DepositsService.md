# Class: DepositsService

Service exposing features related to tBTC v2 deposits.

## Table of contents

### Constructors

- [constructor](DepositsService.md#constructor)

### Properties

- [bitcoinClient](DepositsService.md#bitcoinclient)
- [defaultDepositor](DepositsService.md#defaultdepositor)
- [depositRefundLocktimeDuration](DepositsService.md#depositrefundlocktimeduration)
- [tbtcContracts](DepositsService.md#tbtccontracts)

### Methods

- [generateDepositReceipt](DepositsService.md#generatedepositreceipt)
- [initiateDeposit](DepositsService.md#initiatedeposit)
- [initiateDepositWithProxy](DepositsService.md#initiatedepositwithproxy)
- [setDefaultDepositor](DepositsService.md#setdefaultdepositor)

## Constructors

### constructor

• **new DepositsService**(`tbtcContracts`, `bitcoinClient`): [`DepositsService`](DepositsService.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `tbtcContracts` | [`TBTCContracts`](../README.md#tbtccontracts) |
| `bitcoinClient` | [`BitcoinClient`](../interfaces/BitcoinClient.md) |

#### Returns

[`DepositsService`](DepositsService.md)

#### Defined in

[src/services/deposits/deposits-service.ts:41](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L41)

## Properties

### bitcoinClient

• `Private` `Readonly` **bitcoinClient**: [`BitcoinClient`](../interfaces/BitcoinClient.md)

Bitcoin client handle.

#### Defined in

[src/services/deposits/deposits-service.ts:34](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L34)

___

### defaultDepositor

• `Private` **defaultDepositor**: `undefined` \| [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Chain-specific identifier of the default depositor used for deposits
initiated by this service.

#### Defined in

[src/services/deposits/deposits-service.ts:39](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L39)

___

### depositRefundLocktimeDuration

• `Private` `Readonly` **depositRefundLocktimeDuration**: ``23328000``

Deposit refund locktime duration in seconds.
This is 9 month in seconds assuming 1 month = 30 days

#### Defined in

[src/services/deposits/deposits-service.ts:26](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L26)

___

### tbtcContracts

• `Private` `Readonly` **tbtcContracts**: [`TBTCContracts`](../README.md#tbtccontracts)

Handle to tBTC contracts.

#### Defined in

[src/services/deposits/deposits-service.ts:30](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L30)

## Methods

### generateDepositReceipt

▸ **generateDepositReceipt**(`bitcoinRecoveryAddress`, `depositor`, `extraData?`): `Promise`\<[`DepositReceipt`](../interfaces/DepositReceipt.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `bitcoinRecoveryAddress` | `string` |
| `depositor` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) |
| `extraData?` | [`Hex`](Hex.md) |

#### Returns

`Promise`\<[`DepositReceipt`](../interfaces/DepositReceipt.md)\>

#### Defined in

[src/services/deposits/deposits-service.ts:119](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L119)

___

### initiateDeposit

▸ **initiateDeposit**(`bitcoinRecoveryAddress`, `extraData?`): `Promise`\<[`Deposit`](Deposit.md)\>

Initiates the tBTC v2 deposit process.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinRecoveryAddress` | `string` | P2PKH or P2WPKH Bitcoin address that can be used for emergency recovery of the deposited funds. |
| `extraData?` | [`Hex`](Hex.md) | Optional 32-byte extra data to be included in the deposit script. Cannot be equal to 32 zero bytes. |

#### Returns

`Promise`\<[`Deposit`](Deposit.md)\>

Handle to the initiated deposit process.

**`Throws`**

Throws an error if one of the following occurs:
        - The default depositor is not set
        - There are no active wallet in the Bridge contract
        - The Bitcoin recovery address is not a valid P2(W)PKH
        - The optional extra data is set but is not 32-byte or equals
          to 32 zero bytes.

#### Defined in

[src/services/deposits/deposits-service.ts:61](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L61)

___

### initiateDepositWithProxy

▸ **initiateDepositWithProxy**(`bitcoinRecoveryAddress`, `depositorProxy`, `extraData?`): `Promise`\<[`Deposit`](Deposit.md)\>

Initiates the tBTC v2 deposit process using a depositor proxy.
The depositor proxy initiates minting on behalf of the user (i.e. original
depositor) and receives minted TBTC. This allows the proxy to provide
additional services to the user, such as routing the minted TBTC tokens
to another protocols, in an automated way.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinRecoveryAddress` | `string` | P2PKH or P2WPKH Bitcoin address that can be used for emergency recovery of the deposited funds. |
| `depositorProxy` | [`DepositorProxy`](../interfaces/DepositorProxy.md) | Depositor proxy used to initiate the deposit. |
| `extraData?` | [`Hex`](Hex.md) | Optional 32-byte extra data to be included in the deposit script. Cannot be equal to 32 zero bytes. |

#### Returns

`Promise`\<[`Deposit`](Deposit.md)\>

Handle to the initiated deposit process.

**`See`**

DepositorProxy

**`Throws`**

Throws an error if one of the following occurs:
        - There are no active wallet in the Bridge contract
        - The Bitcoin recovery address is not a valid P2(W)PKH
        - The optional extra data is set but is not 32-byte or equals
          to 32 zero bytes.

#### Defined in

[src/services/deposits/deposits-service.ts:100](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L100)

___

### setDefaultDepositor

▸ **setDefaultDepositor**(`defaultDepositor`): `void`

Sets the default depositor used for deposits initiated by this service.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `defaultDepositor` | [`ChainIdentifier`](../interfaces/ChainIdentifier.md) | Chain-specific identifier of the default depositor. |

#### Returns

`void`

**`Dev`**

Typically, there is no need to use this method when DepositsService
     is orchestrated automatically. However, there are some use cases
     where setting the default depositor explicitly may be useful.
     Make sure you know what you are doing while using this method.

#### Defined in

[src/services/deposits/deposits-service.ts:197](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L197)
