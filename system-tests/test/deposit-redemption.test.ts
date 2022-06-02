import TBTC, { ElectrumClient, EthereumBridge } from "@keep-network/tbtc-v2.ts"
import type { UnspentTransactionOutput } from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import { computeHash160 } from "@keep-network/tbtc-v2.ts/dist/bitcoin"
import type { Deposit } from "@keep-network/tbtc-v2.ts/dist/deposit"
import type { RedemptionRequest } from "@keep-network/tbtc-v2.ts/dist/redemption"
import { BigNumber, constants, Contract } from "ethers"
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
  let bank: Contract

  const depositAmount = BigNumber.from(10000000)
  const depositSweepTxFee = BigNumber.from(10000)

  let deposit: Deposit
  let depositUtxo: UnspentTransactionOutput
  let sweepUtxo: UnspentTransactionOutput
  let redemptionRequest: RedemptionRequest
  let redemptionUtxo: UnspentTransactionOutput

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

    // TODO: Consider implementing bank interactions in the `tbtc-v2.ts` lib.
    const bankDeploymentInfo = contractsDeploymentInfo.contracts["Bank"]
    bank = new Contract(
      bankDeploymentInfo.address,
      bankDeploymentInfo.abi,
      maintainer
    )
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
    before("sweep the deposit and submit sweep proof", async () => {
      sweepUtxo = await TBTC.sweepDeposits(
        electrumClient,
        depositSweepTxFee,
        systemTestsContext.walletBitcoinKeyPair.privateKeyWif,
        true,
        [depositUtxo],
        [deposit]
      )

      console.log(`
        Deposit swept on Bitcoin chain:
        - Transaction hash: ${sweepUtxo.transactionHash}
      `)

      // Unlike in the deposit transaction case, we must wait for the sweep
      // transaction to have an enough number of confirmations. This is
      // because the bridge performs the SPV proof of that transaction.
      await waitTransactionConfirmed(electrumClient, sweepUtxo.transactionHash)

      await TBTC.proveDepositSweep(
        sweepUtxo.transactionHash,
        // This is the first sweep of the given wallet so there is no main UTXO.
        {
          // The function expects an unprefixed hash.
          transactionHash: constants.HashZero.substring(2),
          outputIndex: 0,
          value: BigNumber.from(0),
        },
        maintainerBridgeHandle,
        electrumClient
      )

      console.log(`
        Deposit sweep proved on the bridge
      `)
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

    it("should increase depositor's balance in the bank", async () => {
      const { treasuryFee } = await getDepositFromBridge(
        systemTestsContext,
        depositUtxo
      )

      const expectedBalance = depositAmount
        .sub(treasuryFee)
        .sub(depositSweepTxFee)

      const actualBalance = await bank.balanceOf(
        systemTestsContext.depositor.address
      )

      expect(actualBalance).to.be.equal(expectedBalance)
    })
  })

  context("when redemption is requested", () => {
    let requestedAmount: BigNumber
    let redeemerOutputScript: string

    before("request the redemption", async () => {
      // Redeem the full depositor's balance.
      requestedAmount = await bank.balanceOf(
        systemTestsContext.depositor.address
      )
      // Request redemption to depositor's address.
      redeemerOutputScript = `0014${computeHash160(
        systemTestsContext.depositorBitcoinKeyPair.compressedPublicKey
      )}`

      await TBTC.requestRedemption(
        systemTestsContext.walletBitcoinKeyPair.compressedPublicKey,
        sweepUtxo,
        redeemerOutputScript,
        requestedAmount,
        depositorBridgeHandle
      )

      console.log(`
        Requested redemption of amount ${requestedAmount} to script ${redeemerOutputScript} on the bridge
      `)

      // TODO: Consider exposing redemption request getter directly in the
      //       `tbtc-v2.ts` default export object.
      redemptionRequest = await maintainerBridgeHandle.pendingRedemptions(
        systemTestsContext.walletBitcoinKeyPair.compressedPublicKey,
        redeemerOutputScript
      )
    })

    it("should register the redemption request on the bridge", async () => {
      expect(redemptionRequest.requestedAt).to.be.greaterThan(0)
      expect(redemptionRequest.requestedAmount).to.be.equal(requestedAmount)
      expect(redemptionRequest.redeemerOutputScript).to.be.equal(
        redeemerOutputScript
      )
    })
  })

  context("when redemption is made and redemption proof submitted", () => {
    before("make the redemption and submit redemption proof", async () => {
      redemptionUtxo = await TBTC.makeRedemptions(
        electrumClient,
        maintainerBridgeHandle,
        systemTestsContext.walletBitcoinKeyPair.compressedPublicKey,
        sweepUtxo,
        [redemptionRequest.redeemerOutputScript],
        true
      )

      console.log(`
        Redemption made on Bitcoin chain:
        - Transaction hash: ${redemptionUtxo.transactionHash}
      `)

      await waitTransactionConfirmed(
        electrumClient,
        redemptionUtxo.transactionHash
      )

      await TBTC.proveRedemption(
        redemptionUtxo.transactionHash,
        sweepUtxo,
        systemTestsContext.walletBitcoinKeyPair.compressedPublicKey,
        maintainerBridgeHandle,
        electrumClient
      )

      console.log(`
        Redemption proved on the bridge
      `)
    })

    it("should broadcast the redemption transaction on the Bitcoin network", async () => {
      expect(
        (await electrumClient.getRawTransaction(redemptionUtxo.transactionHash))
          .transactionHex.length
      ).to.be.greaterThan(0)
    })

    it("should close the redemption request on the bridge", async () => {
      const { requestedAt } = await maintainerBridgeHandle.pendingRedemptions(
        systemTestsContext.walletBitcoinKeyPair.compressedPublicKey,
        redemptionRequest.redeemerOutputScript
      )

      expect(requestedAt).to.be.equal(0)
    })

    it("should decrease depositor's balance in the bank", async () => {
      const actualBalance = await bank.balanceOf(
        systemTestsContext.depositor.address
      )

      expect(actualBalance).to.be.equal(0)
    })
  })
})
