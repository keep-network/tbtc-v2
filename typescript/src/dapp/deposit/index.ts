import { BigNumber, providers } from "ethers"

import { ElectrumClient, EthereumBridge, TBTC } from "../../../dist"
import { RawTransaction } from "../../bitcoin"
import { assembleDepositTransaction } from "../../deposit"

import {
  testnetUTXO as depositTestnetUTXO,
  testnetPrivateKey as depositTestnetPrivateKey,
} from "./data"
import { generateDeposit } from "./utils"
;(async () => {
  // TODO: Update the `Bridge` contract address.
  const bridgeAddress = "0xDc2F7BC977E1B3947c908E2F55A33f07E90B6368"
  // TODO: Update the provider URL.
  const provider = new providers.JsonRpcProvider("http://127.0.0.1:8545")

  const bridge = new EthereumBridge({
    address: bridgeAddress,
    signer: provider.getSigner(),
  })

  // There is no need to set the correct config for the electrum client because
  // we mock the `getRawTransaction` function so the electrum is not actually
  // called.
  const depositBitcoinClient = new ElectrumClient({
    host: "ws://127.0.0.1",
    port: 8545,
    protocol: "ws",
  })

  const depositAmount = BigNumber.from(1900000) // 0.019 BTC

  const activeWalletPublicKey = await bridge.activeWalletPublicKey()

  const deposit = generateDeposit(
    await provider.getSigner(0).getAddress(),
    depositAmount,
    activeWalletPublicKey!
  )

  const result = await assembleDepositTransaction(
    deposit,
    [depositTestnetUTXO],
    depositTestnetPrivateKey,
    true
  )

  const transaction = result.rawTransaction
  const depositUtxo = result.depositUtxo

  depositBitcoinClient.getRawTransaction = async (
    transactionHash: string
  ): Promise<RawTransaction> => {
    return transaction
  }

  await TBTC.revealDeposit(depositUtxo, deposit, depositBitcoinClient, bridge)
})()
