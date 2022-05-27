import TBTC, { ElectrumClient, EthereumBridge } from "@keep-network/tbtc-v2.ts"
import { UnspentTransactionOutput } from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import { Deposit } from "@keep-network/tbtc-v2.ts/dist/deposit"
import {
  parseElectrumCredentials,
  setupSystemTests,
  SystemTestsContext,
} from "./setup"
import { BigNumber } from "ethers"
import { createWallet, generateDeposit } from "./utils"
import { expect } from "chai"

describe("System Test - Deposit and redemption", () => {
  let systemTestsContext: SystemTestsContext
  let electrumClient: ElectrumClient
  // eslint-disable-next-line no-unused-vars
  let maintainerBridgeHandle: EthereumBridge
  let depositorBridgeHandle: EthereumBridge

  before(async () => {
    systemTestsContext = await setupSystemTests()
    const { electrumUrl, maintainer, depositor, bridgeAddress } =
      systemTestsContext

    electrumClient = new ElectrumClient(parseElectrumCredentials(electrumUrl))

    maintainerBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signer: maintainer,
    })

    depositorBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signer: depositor,
    })
  })

  context("when wallet is created", () => {
    let walletPublicKey: string
    // eslint-disable-next-line no-unused-vars
    let walletPrivateKey: string

    before("create a wallet", async () => {
      ;({ walletPublicKey, walletPrivateKey } = await createWallet(
        systemTestsContext
      ))
    })

    context("when deposit is made and revealed", () => {
      let deposit: Deposit
      let depositUtxo: UnspentTransactionOutput

      before("make and reveal deposit", async () => {
        deposit = generateDeposit(
          systemTestsContext.depositor.address,
          BigNumber.from(100000),
          walletPublicKey
        )

        console.log(`Generated deposit data`)

        depositUtxo = await TBTC.makeDeposit(
          deposit,
          systemTestsContext.depositorBitcoinPrivateKey,
          electrumClient,
          true
        )

        console.log(`
          Deposit made on BTC chain:
          - Transaction hash: ${depositUtxo.transactionHash}
          - Output index: ${depositUtxo.value}
        `)

        await TBTC.revealDeposit(
          depositUtxo,
          deposit,
          electrumClient,
          depositorBridgeHandle
        )

        console.log(`Deposit revealed on Ethereum chain`)
      })

      // TODO: Temporary assertion.
      it("should work", async () => {
        expect(await electrumClient.latestBlockHeight()).to.be.greaterThan(0)
        expect(
          await depositorBridgeHandle.txProofDifficultyFactor()
        ).to.be.equal(1)
      })
    })
  })
})
