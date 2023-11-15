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

[src/services/deposits/deposits-service.ts:40](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L40)

## Properties

### bitcoinClient

• `Private` `Readonly` **bitcoinClient**: [`BitcoinClient`](../interfaces/BitcoinClient.md)

Bitcoin client handle.

#### Defined in

[src/services/deposits/deposits-service.ts:33](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L33)

___

### defaultDepositor

• `Private` **defaultDepositor**: `undefined` \| [`ChainIdentifier`](../interfaces/ChainIdentifier.md)

Chain-specific identifier of the default depositor used for deposits
initiated by this service.

#### Defined in

[src/services/deposits/deposits-service.ts:38](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L38)

___

### depositRefundLocktimeDuration

• `Private` `Readonly` **depositRefundLocktimeDuration**: ``23328000``

Deposit refund locktime duration in seconds.
This is 9 month in seconds assuming 1 month = 30 days

#### Defined in

[src/services/deposits/deposits-service.ts:25](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L25)

___

### tbtcContracts

• `Private` `Readonly` **tbtcContracts**: [`TBTCContracts`](../README.md#tbtccontracts)

Handle to tBTC contracts.

#### Defined in

[src/services/deposits/deposits-service.ts:29](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L29)

## Methods

### generateDepositReceipt

▸ **generateDepositReceipt**(`bitcoinRecoveryAddress`): `Promise`\<[`DepositReceipt`](../interfaces/DepositReceipt.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `bitcoinRecoveryAddress` | `string` |

#### Returns

`Promise`\<[`DepositReceipt`](../interfaces/DepositReceipt.md)\>

#### Defined in

[src/services/deposits/deposits-service.ts:62](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L62)

___

### initiateDeposit

▸ **initiateDeposit**(`bitcoinRecoveryAddress`): `Promise`\<[`Deposit`](Deposit.md)\>

Initiates the tBTC v2 deposit process.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `bitcoinRecoveryAddress` | `string` | P2PKH or P2WPKH Bitcoin address that can be used for emergency recovery of the deposited funds. |

#### Returns

`Promise`\<[`Deposit`](Deposit.md)\>

Handle to the initiated deposit process.

**`Throws`**

Throws an error if one of the following occurs:
        - The default depositor is not set
        - There are no active wallet in the Bridge contract
        - The Bitcoin recovery address is not a valid P2(W)PKH

#### Defined in

[src/services/deposits/deposits-service.ts:57](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L57)

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

[src/services/deposits/deposits-service.ts:125](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/services/deposits/deposits-service.ts#L125)
