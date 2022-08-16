import { BigNumber, Contract, providers } from "ethers"
import { abi as BankABI } from "@keep-network/tbtc-v2/artifacts/Bank.json"

import { EthereumBridge, TBTC } from "../../../dist"
import { computeHash160 } from "../../bitcoin"
;(async () => {
  // TODO: Update the `Bridge` contract address.
  const bridgeAddress = "0xDc2F7BC977E1B3947c908E2F55A33f07E90B6368"
  // TODO: Update the `Bank` contract address.
  const bankAddress = "0xcC4Bb7E942726a092E9DA0f823d568A578Ca1BCb"
  const btcDepositorAddress =
    "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9"

  // TODO: Update the provider URL.
  const provider = new providers.JsonRpcProvider("http://127.0.0.1:8545")

  const bank = new Contract(bankAddress, BankABI, provider)
  const bridge = new EthereumBridge({
    address: bridgeAddress,
    signer: provider.getSigner(),
  })

  const depositor = provider.getSigner()
  const depositorAddress = await depositor.getAddress()
  // Redeem the full depositor's balance.
  const requestedAmount = await bank.balanceOf(depositorAddress)

  // Allow the bridge to take the redeemed bank balance.
  await bank.connect(depositor).approveBalance(bridgeAddress, requestedAmount)

  const activeWalletPublicKey = await bridge.activeWalletPublicKey()

  // Request redemption to depositor's address.
  const redeemerOutputScript = `0014${computeHash160(btcDepositorAddress)}`

  // TODO: Update the utxo- must be the same as stored in the `Bridge` contract.
  // For the dapp-friendly `Bridge` contract the utxo will be the same as we
  // created the mocked ecdsa wallet using the hardhat task
  // `dapp:register-wallet`. In real implementation, the dapp needs to find the
  // main utxo for a given wallet.
  const sweepUtxo = {
    transactionHash:
      "2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883",
    outputIndex: 1,
    value: BigNumber.from(3933200),
  }

  await TBTC.requestRedemption(
    activeWalletPublicKey!,
    sweepUtxo,
    redeemerOutputScript,
    requestedAmount,
    bridge
  )

  console.log(`
    Requested redemption of amount ${requestedAmount.toString()} to script ${redeemerOutputScript} on the bridge
  `)

  const redemptionRequest = await TBTC.getRedemptionRequest(
    activeWalletPublicKey!,
    redeemerOutputScript,
    "pending",
    bridge
  )

  console.log(
    "Redemption request created at:",
    redemptionRequest.requestedAt.toString()
  )
})()
