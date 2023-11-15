# Interface: ElectrumCredentials

Represents a set of credentials required to establish an Electrum connection.

## Table of contents

### Properties

- [host](ElectrumCredentials.md#host)
- [port](ElectrumCredentials.md#port)
- [protocol](ElectrumCredentials.md#protocol)

## Properties

### host

• **host**: `string`

Host pointing to the Electrum server.

#### Defined in

[src/lib/electrum/client.ts:34](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/electrum/client.ts#L34)

___

### port

• **port**: `number`

Port the Electrum server listens on.

#### Defined in

[src/lib/electrum/client.ts:38](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/electrum/client.ts#L38)

___

### protocol

• **protocol**: ``"tcp"`` \| ``"tls"`` \| ``"ssl"`` \| ``"ws"`` \| ``"wss"``

Protocol used by the Electrum server.

#### Defined in

[src/lib/electrum/client.ts:42](https://github.com/keep-network/tbtc-v2/blob/main/typescript/src/lib/electrum/client.ts#L42)
