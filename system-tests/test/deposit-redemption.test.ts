import TBTC, { ElectrumClient, EthereumBridge } from "@keep-network/tbtc-v2.ts"
import type { UnspentTransactionOutput } from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import { Deposit } from "@keep-network/tbtc-v2.ts/dist/deposit"
import { BigNumber, constants } from "ethers"
import { expect } from "chai"
import { parseElectrumCredentials } from "./utils/electrum"
import { setupSystemTestsContext, SystemTestsContext } from "./utils/context"
import { generateDeposit, getDepositFromBridge } from "./utils/deposit"
import { waitTransactionConfirmed } from "./utils/bitcoin"

describe("System Test - Deposit and redemption", () => {
  let systemTestsContext: SystemTestsContext
  let electrumClient: ElectrumClient
  let maintainerBridgeHandle: EthereumBridge
  let depositorBridgeHandle: EthereumBridge

  const depositAmount = BigNumber.from(1000000)
  const depositSweepTxFee = BigNumber.from(8000)

  let deposit: Deposit
  let depositUtxo: UnspentTransactionOutput

  before(async () => {
    systemTestsContext = await setupSystemTestsContext()
    const { electrumUrl, maintainer, depositor, contractsDeploymentInfo } =
      systemTestsContext

    electrumClient = new ElectrumClient(parseElectrumCredentials(electrumUrl))

    const bridgeAddress = contractsDeploymentInfo.contracts["Bridge"].address

    maintainerBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signer: maintainer,
    })

    depositorBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signer: depositor,
    })
  })

  context("when deposit is made and revealed", () => {
    before("make and reveal deposit", async () => {
      deposit = generateDeposit(
        systemTestsContext.depositor.address,
        depositAmount,
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

    it("should broadcast the deposit transaction on the Bitcoin network", async () => {
      expect(
        (await electrumClient.getRawTransaction(depositUtxo.transactionHash))
          .transactionHex.length
      ).to.be.greaterThan(0)
    })

    it("should reveal the deposit to the bridge", async () => {
      const { revealedAt } = await getDepositFromBridge(
        systemTestsContext,
        depositUtxo
      )
      expect(revealedAt).to.be.greaterThan(0)
    })
  })

  context("when deposit is swept and sweep proof submitted", () => {
    let sweepUtxo: UnspentTransactionOutput

    before("sweep the deposit and submit sweep proof", async () => {
      // TODO: Assign result to `sweepUtxo` once the required change is done in tbtc-v2.ts library.
      await TBTC.sweepDeposits(
        electrumClient,
        depositSweepTxFee,
        systemTestsContext.walletBitcoinKeyPair.privateKeyWif,
        true,
        [depositUtxo],
        [deposit]
      )

      // Unlike in the deposit transaction case, we must wait for the sweep
      // transaction to have an enough number of confirmations. This is
      // because the bridge performs the SPV proof of that transaction.
      await waitTransactionConfirmed(electrumClient, sweepUtxo.transactionHash)

      await TBTC.proveDepositSweep(
        sweepUtxo.transactionHash,
        // This is the first sweep of the given wallet so there is no main UTXO.
        {
          transactionHash: constants.HashZero,
          outputIndex: 0,
          value: BigNumber.from(0),
        },
        maintainerBridgeHandle,
        electrumClient
      )
    })

    it("should broadcast the sweep transaction on the Bitcoin network", async () => {
      expect(
        (await electrumClient.getRawTransaction(sweepUtxo.transactionHash))
          .transactionHex.length
      ).to.be.greaterThan(0)
    })

    it("should sweep the deposit on the bridge", async () => {
      const { sweptAt } = await getDepositFromBridge(
        systemTestsContext,
        depositUtxo
      )
      expect(sweptAt).to.be.greaterThan(0)
    })
  })
})
