import TBTC, { ElectrumClient, EthereumBridge } from "@keep-network/tbtc-v2.ts"
import type { UnspentTransactionOutput } from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import { Deposit } from "@keep-network/tbtc-v2.ts/dist/deposit"
import { BigNumber } from "ethers"
import { expect } from "chai"
import { parseElectrumCredentials } from "./utils/electrum"
import { setupSystemTestsContext, SystemTestsContext } from "./utils/context"
import { generateDeposit, isDepositRevealed } from "./utils/deposit"

describe("System Test - Deposit and redemption", () => {
  let systemTestsContext: SystemTestsContext
  let electrumClient: ElectrumClient
  let depositorBridgeHandle: EthereumBridge

  before(async () => {
    systemTestsContext = await setupSystemTestsContext()
    const { electrumUrl, depositor, contractsDeploymentInfo } =
      systemTestsContext

    electrumClient = new ElectrumClient(parseElectrumCredentials(electrumUrl))

    const bridgeAddress = contractsDeploymentInfo.contracts["Bridge"].address

    depositorBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signer: depositor,
    })
  })

  context("when deposit is made and revealed", () => {
    let deposit: Deposit
    let depositUtxo: UnspentTransactionOutput

    before("make and reveal deposit", async () => {
      deposit = generateDeposit(
        systemTestsContext.depositor.address,
        BigNumber.from(1000000),
        systemTestsContext.walletBitcoinKeyPair.compressedPublicKey
      )

      console.log(`
          Generated deposit data
        `)

      depositUtxo = await TBTC.makeDeposit(
        deposit,
        systemTestsContext.depositorBitcoinKeyPair.privateKeyWif,
        electrumClient,
        true
      )

      console.log(`
          Deposit made on BTC chain:
          - Transaction hash: ${depositUtxo.transactionHash}
          - Output index: ${depositUtxo.outputIndex}
        `)

      // Since the reveal deposit logic does not perform SPV proof, we
      // can reveal the deposit transaction immediately without waiting
      // for confirmations.
      await TBTC.revealDeposit(
        depositUtxo,
        deposit,
        electrumClient,
        depositorBridgeHandle
      )

      console.log(`
          Deposit revealed on Ethereum chain
        `)
    })

    it("should broadcast the deposit transaction on Bitcoin network", async () => {
      expect(
        (await electrumClient.getRawTransaction(depositUtxo.transactionHash))
          .transactionHex.length
      ).to.be.greaterThan(0)
    })

    it("should reveal the deposit to the bridge", async () => {
      expect(await isDepositRevealed(systemTestsContext, depositUtxo)).to.be
        .true
    })
  })
})
