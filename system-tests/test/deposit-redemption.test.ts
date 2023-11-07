import {
  extractBitcoinRawTxVectors,
  Hex,
  BitcoinTxHash,
  BitcoinNetwork,
  ElectrumClient,
  EthereumBridge,
  EthereumTBTCToken,
  EthereumTBTCVault,
  DepositFunding,
  DepositScript,
  BitcoinAddressConverter,
  WalletTx,
  EthereumWalletRegistry,
  MaintenanceService,
  BitcoinHashUtils,
  EthereumAddress,
} from "@keep-network/tbtc-v2.ts"
import { BigNumber, constants, Contract } from "ethers"
import chai, { expect } from "chai"
import chaiAsPromised from "chai-as-promised"

import { setupSystemTestsContext } from "./utils/context"
import { createDepositReceipt } from "./utils/deposit"
import { fakeRelayDifficulty, waitTransactionConfirmed } from "./utils/bitcoin"

import type {
  RedemptionRequest,
  BitcoinUtxo,
  DepositReceipt,
  TBTCContracts,
} from "@keep-network/tbtc-v2.ts"
import type { SystemTestsContext } from "./utils/context"

chai.use(chaiAsPromised)

/**
 * This system test scenario performs a single deposit and redemption.
 *
 * The scenario consists of the following steps:
 * 1. The depositor broadcasts the deposit transaction on BTC chain and reveals
 *    it to the bridge.
 * 2. The wallet broadcasts the sweep transaction of the given deposit on BTC
 *    chain and submits the sweep proof to the bridge.
 * 3. The depositor (redeemer) requests the redemption of its entire bank
 *    balance.
 * 4. The wallet broadcasts the redemption transaction handling the given
 *    request and submits the redemption proof to the bridge.
 *
 * Following prerequisites must be fulfilled to make a successful pass:
 * - The depositor's BTC balance must allow to perform the deposit
 * - tBTC v2 contracts must be deployed on used Ethereum network
 * - A fresh live wallet (with no main UTXO yet) must be registered in
 *   the bridge
 */
describe("System Test - Deposit and redemption", () => {
  let systemTestsContext: SystemTestsContext
  let electrumClient: ElectrumClient
  let tbtcTokenAddress: string
  let bridgeAddress: string
  let vaultAddress: string
  let walletRegistryAddress: string
  let tbtcTokenHandle: EthereumTBTCToken
  let vaultHandle: EthereumTBTCVault
  let maintainerBridgeHandle: EthereumBridge
  let depositorBridgeHandle: EthereumBridge
  let walletRegistryHandle: EthereumWalletRegistry

  let walletTx: WalletTx
  let maintenanceService: MaintenanceService

  let bank: Contract
  let relay: Contract
  let tbtc: Contract

  const depositAmount = BigNumber.from(2000000)
  const depositSweepTxFee = BigNumber.from(10000)
  const depositTxFee = BigNumber.from(1500)
  // Number of retries for Electrum requests.
  const ELECTRUM_RETRIES = 5
  // Initial backoff step in milliseconds that will be increased exponentially for
  // subsequent Electrum retry attempts.
  const ELECTRUM_RETRY_BACKOFF_STEP_MS = 10000 // 10sec
  // Multiplier to convert satoshi to TBTC token units.
  const SATOSHI_MULTIPLIER = BigNumber.from(10000000000)

  let depositReceipt: DepositReceipt
  let depositUtxo: BitcoinUtxo
  let sweepUtxo: BitcoinUtxo
  let redemptionUtxo: BitcoinUtxo | undefined

  before(async () => {
    systemTestsContext = await setupSystemTestsContext()
    const { electrumUrl, maintainer, depositor, deployedContracts } =
      systemTestsContext

    electrumClient = ElectrumClient.fromUrl(
      electrumUrl,
      undefined,
      ELECTRUM_RETRIES,
      ELECTRUM_RETRY_BACKOFF_STEP_MS
    )

    tbtcTokenAddress = deployedContracts.TBTC.address
    bridgeAddress = deployedContracts.Bridge.address
    vaultAddress = deployedContracts.TBTCVault.address
    walletRegistryAddress = deployedContracts.WalletRegistry.address

    tbtcTokenHandle = new EthereumTBTCToken({
      address: tbtcTokenAddress,
      signerOrProvider: depositor,
    })

    vaultHandle = new EthereumTBTCVault({
      address: vaultAddress,
      signerOrProvider: depositor,
    })

    maintainerBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signerOrProvider: maintainer,
    })

    depositorBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signerOrProvider: depositor,
    })

    walletRegistryHandle = new EthereumWalletRegistry({
      address: walletRegistryAddress,
      signerOrProvider: depositor,
    })

    const tbtcContracts: TBTCContracts = {
      bridge: maintainerBridgeHandle,
      tbtcToken: tbtcTokenHandle,
      tbtcVault: vaultHandle,
      walletRegistry: walletRegistryHandle,
    }

    walletTx = new WalletTx(tbtcContracts, electrumClient)
    maintenanceService = new MaintenanceService(tbtcContracts, electrumClient)

    const bankDeploymentInfo = deployedContracts.Bank
    bank = new Contract(
      bankDeploymentInfo.address,
      bankDeploymentInfo.abi,
      maintainer
    )

    const relayDeploymentInfo = deployedContracts.LightRelay
    relay = new Contract(
      relayDeploymentInfo.address,
      relayDeploymentInfo.abi,
      maintainer
    )

    const tbtcDeploymentInfo = deployedContracts.TBTC
    tbtc = new Contract(
      tbtcDeploymentInfo.address,
      tbtcDeploymentInfo.abi,
      maintainer
    )
  })

  context("when deposit is made and revealed without a vault", () => {
    before("make and reveal deposit", async () => {
      depositReceipt = createDepositReceipt(
        systemTestsContext.depositor.address,
        systemTestsContext.walletBitcoinKeyPair.publicKey.compressed
      )

      console.log(`
        Generated deposit data:
        ${JSON.stringify(depositReceipt)}
      `)

      const depositorBitcoinAddress =
        BitcoinAddressConverter.publicKeyToAddress(
          systemTestsContext.depositorBitcoinKeyPair.publicKey.compressed,
          BitcoinNetwork.Testnet
        )

      const depositorUtxos =
        await electrumClient.findAllUnspentTransactionOutputs(
          depositorBitcoinAddress
        )

      const depositFunding = DepositFunding.fromScript(
        DepositScript.fromReceipt(depositReceipt, true)
      )

      ;({ depositUtxo } = await depositFunding.submitTransaction(
        depositAmount,
        depositorUtxos,
        depositTxFee,
        systemTestsContext.depositorBitcoinKeyPair.wif,
        electrumClient
      ))

      console.log(`
        Deposit made on BTC chain:
        - Transaction hash: ${depositUtxo.transactionHash}
        - Output index: ${depositUtxo.outputIndex}
      `)

      // Since the reveal deposit logic does not perform SPV proof, we
      // can reveal the deposit transaction immediately without waiting
      // for confirmations.
      const rawDepositTransaction = await electrumClient.getRawTransaction(
        depositUtxo.transactionHash
      )
      const depositRawTxVectors = extractBitcoinRawTxVectors(
        rawDepositTransaction
      )
      depositorBridgeHandle.revealDeposit(
        depositRawTxVectors,
        depositUtxo.outputIndex,
        depositReceipt
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
      const { revealedAt } = await maintainerBridgeHandle.deposits(
        depositUtxo.transactionHash,
        depositUtxo.outputIndex
      )
      expect(revealedAt).to.be.greaterThan(0)
    })

    context("when deposit is swept and sweep proof submitted", () => {
      before("sweep the deposit and submit sweep proof", async () => {
        ;({ newMainUtxo: sweepUtxo } =
          await walletTx.depositSweep.submitTransaction(
            depositSweepTxFee,
            systemTestsContext.walletBitcoinKeyPair.wif,
            [depositUtxo],
            [depositReceipt]
          ))

        console.log(`
        Deposit swept on Bitcoin chain:
        - Transaction hash: ${sweepUtxo.transactionHash}
      `)

        // Unlike in the deposit transaction case, we must wait for the sweep
        // transaction to have an enough number of confirmations. This is
        // because the bridge performs the SPV proof of that transaction.
        await waitTransactionConfirmed(
          electrumClient,
          sweepUtxo.transactionHash
        )

        await fakeRelayDifficulty(
          relay,
          electrumClient,
          sweepUtxo.transactionHash
        )

        // TODO: Consider fetching the current wallet main UTXO and passing it
        //       here. This will allow running this test scenario multiple
        //       times for the same wallet.
        await maintenanceService.spv.submitDepositSweepProof(
          sweepUtxo.transactionHash,
          // This is the first sweep of the given wallet so there is no main UTXO.
          {
            // The function expects an unprefixed hash.
            transactionHash: BitcoinTxHash.from(constants.HashZero),
            outputIndex: 0,
            value: BigNumber.from(0),
          }
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
        const { sweptAt } = await maintainerBridgeHandle.deposits(
          depositUtxo.transactionHash,
          depositUtxo.outputIndex
        )
        expect(sweptAt).to.be.greaterThan(0)
      })

      it("should increase depositor's balance in the bank", async () => {
        const { treasuryFee } = await maintainerBridgeHandle.deposits(
          depositUtxo.transactionHash,
          depositUtxo.outputIndex
        )

        const expectedBalance = depositAmount
          .sub(treasuryFee)
          .sub(depositSweepTxFee)

        const actualBalance = await bank.balanceOf(
          systemTestsContext.depositor.address
        )

        expect(actualBalance).to.be.equal(expectedBalance)
      })

      context("when redemption is requested", () => {
        let requestedAmount: BigNumber
        let redeemerOutputScript: string
        let redemptionRequest: RedemptionRequest

        before("request the redemption", async () => {
          // Redeem the full depositor's balance.
          requestedAmount = await bank.balanceOf(
            systemTestsContext.depositor.address
          )

          // Allow the bridge to take the redeemed bank balance.
          await bank
            .connect(systemTestsContext.depositor)
            .approveBalance(bridgeAddress, requestedAmount)

          // Request redemption to depositor's address.
          redeemerOutputScript = `0014${BitcoinHashUtils.computeHash160(
            systemTestsContext.depositorBitcoinKeyPair.publicKey.compressed
          )}`

          await depositorBridgeHandle.requestRedemption(
            systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
            sweepUtxo,
            Hex.from(redeemerOutputScript),
            requestedAmount
          )

          console.log(
            `Requested redemption of amount ${requestedAmount} to script ${redeemerOutputScript} on the bridge`
          )

          redemptionRequest = await maintainerBridgeHandle.pendingRedemptions(
            systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
            Hex.from(redeemerOutputScript)
          )
        })

        it("should transfer depositor's bank balance to the Bridge", async () => {
          expect(
            await bank.balanceOf(systemTestsContext.depositor.address)
          ).to.be.equal(0)

          expect(await bank.balanceOf(bridgeAddress)).to.be.equal(
            requestedAmount
          )
        })

        it("should register the redemption request on the bridge", async () => {
          expect(redemptionRequest.requestedAt).to.be.greaterThan(0)
          expect(redemptionRequest.requestedAmount).to.be.equal(requestedAmount)
          expect(redemptionRequest.redeemerOutputScript).to.be.equal(
            redeemerOutputScript
          )
        })

        context(
          "when redemption is made and redemption proof submitted",
          () => {
            let redemptionTxHash: BitcoinTxHash

            before(
              "make the redemption and submit redemption proof",
              async () => {
                ;({
                  transactionHash: redemptionTxHash,
                  newMainUtxo: redemptionUtxo,
                } = await walletTx.redemption.submitTransaction(
                  systemTestsContext.walletBitcoinKeyPair.wif,
                  sweepUtxo,
                  [redemptionRequest.redeemerOutputScript]
                ))

                console.log(
                  "Redemption made on Bitcoin chain:\n" +
                    `- Transaction hash: ${redemptionTxHash}`
                )

                await waitTransactionConfirmed(electrumClient, redemptionTxHash)

                await fakeRelayDifficulty(
                  relay,
                  electrumClient,
                  redemptionTxHash
                )

                await maintenanceService.spv.submitRedemptionProof(
                  redemptionTxHash,
                  sweepUtxo,
                  systemTestsContext.walletBitcoinKeyPair.publicKey.compressed
                )

                console.log("Redemption proved on the bridge")
              }
            )

            it("should broadcast the redemption transaction on the Bitcoin network", async () => {
              expect(
                (await electrumClient.getRawTransaction(redemptionTxHash))
                  .transactionHex.length
              ).to.be.greaterThan(0)
            })

            it("should close the redemption request on the bridge", async () => {
              await expect(
                maintainerBridgeHandle.pendingRedemptions(
                  systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
                  redemptionRequest.redeemerOutputScript
                )
              ).to.be.rejectedWith(
                "Provided redeemer output script and wallet public key do not identify a redemption request"
              )
            })

            it("should decrease Bridge's balance in the bank", async () => {
              const actualBalance = await bank.balanceOf(bridgeAddress)

              expect(actualBalance).to.be.equal(0)
            })
          }
        )
      })
    })
  })

  context("when deposit is made and revealed with a vault", () => {
    before("make and reveal deposit", async () => {
      depositReceipt = createDepositReceipt(
        systemTestsContext.depositor.address,
        systemTestsContext.walletBitcoinKeyPair.publicKey.compressed
      )

      console.log(`
        Generated deposit data:
        ${JSON.stringify(depositReceipt)}
      `)

      const depositorBitcoinAddress =
        BitcoinAddressConverter.publicKeyToAddress(
          systemTestsContext.depositorBitcoinKeyPair.publicKey.compressed,
          BitcoinNetwork.Testnet
        )

      const depositorUtxos =
        await electrumClient.findAllUnspentTransactionOutputs(
          depositorBitcoinAddress
        )

      const depositFunding = DepositFunding.fromScript(
        DepositScript.fromReceipt(depositReceipt, true)
      )

      ;({ depositUtxo } = await depositFunding.submitTransaction(
        depositAmount,
        depositorUtxos,
        depositTxFee,
        systemTestsContext.depositorBitcoinKeyPair.wif,
        electrumClient
      ))

      console.log(`
        Deposit made on BTC chain:
        - Transaction hash: ${depositUtxo.transactionHash}
        - Output index: ${depositUtxo.outputIndex}
      `)

      // Since the reveal deposit logic does not perform SPV proof, we
      // can reveal the deposit transaction immediately without waiting
      // for confirmations.
      const rawDepositTransaction = await electrumClient.getRawTransaction(
        depositUtxo.transactionHash
      )
      const depositRawTxVectors = extractBitcoinRawTxVectors(
        rawDepositTransaction
      )
      depositorBridgeHandle.revealDeposit(
        depositRawTxVectors,
        depositUtxo.outputIndex,
        depositReceipt,
        EthereumAddress.from(vaultAddress)
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
      const { revealedAt } = await maintainerBridgeHandle.deposits(
        depositUtxo.transactionHash,
        depositUtxo.outputIndex
      )
      expect(revealedAt).to.be.greaterThan(0)
    })

    context("when deposit is swept and sweep proof submitted", () => {
      before("sweep the deposit and submit sweep proof", async () => {
        ;({ newMainUtxo: sweepUtxo } =
          await walletTx.depositSweep.submitTransaction(
            depositSweepTxFee,
            systemTestsContext.walletBitcoinKeyPair.wif,
            [depositUtxo],
            [depositReceipt],
            redemptionUtxo // The UTXO from the previous test became the new main UTXO.
          ))

        console.log(`
        Deposit swept on Bitcoin chain:
        - Transaction hash: ${sweepUtxo.transactionHash}
      `)

        // Unlike in the deposit transaction case, we must wait for the sweep
        // transaction to have an enough number of confirmations. This is
        // because the bridge performs the SPV proof of that transaction.
        await waitTransactionConfirmed(
          electrumClient,
          sweepUtxo.transactionHash
        )

        await fakeRelayDifficulty(
          relay,
          electrumClient,
          sweepUtxo.transactionHash
        )

        // If the redemption transaction from the previous test created a new
        // main UTXO, use it. Otherwise call it with a zero-filled main UTXO.
        const mainUtxo = redemptionUtxo || {
          transactionHash: BitcoinTxHash.from(constants.HashZero),
          outputIndex: 0,
          value: BigNumber.from(0),
        }
        await maintenanceService.spv.submitDepositSweepProof(
          sweepUtxo.transactionHash,
          mainUtxo,
          EthereumAddress.from(vaultAddress)
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
        const { sweptAt } = await maintainerBridgeHandle.deposits(
          depositUtxo.transactionHash,
          depositUtxo.outputIndex
        )
        expect(sweptAt).to.be.greaterThan(0)
      })

      it("should increase vault's balance in the bank", async () => {
        const { treasuryFee } = await maintainerBridgeHandle.deposits(
          depositUtxo.transactionHash,
          depositUtxo.outputIndex
        )

        const expectedBalance = depositAmount
          .sub(treasuryFee)
          .sub(depositSweepTxFee)

        const actualBalance = await bank.balanceOf(vaultAddress)

        expect(actualBalance).to.be.equal(expectedBalance)
      })

      it("should mint TBTC tokens for the depositor", async () => {
        const { treasuryFee } = await maintainerBridgeHandle.deposits(
          depositUtxo.transactionHash,
          depositUtxo.outputIndex
        )

        const balanceInSatoshis = depositAmount
          .sub(treasuryFee)
          .sub(depositSweepTxFee)

        const expectedTbtcBalance = balanceInSatoshis.mul(SATOSHI_MULTIPLIER)

        const actualBalance = await tbtc.balanceOf(
          systemTestsContext.depositor.address
        )

        expect(actualBalance).to.be.equal(expectedTbtcBalance)
      })

      context("when redemption is requested", () => {
        let requestedAmount: BigNumber
        let redeemerOutputScript: string
        let redemptionRequest: RedemptionRequest

        before("request the redemption", async () => {
          // Redeem all of the depositor's TBTC tokens.
          const tbtcBalanceOfDepositor = await tbtc.balanceOf(
            systemTestsContext.depositor.address
          )

          // The depositor's balance converted to satoshis.
          requestedAmount = tbtcBalanceOfDepositor.div(SATOSHI_MULTIPLIER)

          // Request redemption to depositor's address.
          redeemerOutputScript = `0014${BitcoinHashUtils.computeHash160(
            systemTestsContext.depositorBitcoinKeyPair.publicKey.compressed
          )}`

          await depositorBridgeHandle.requestRedemption(
            systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
            sweepUtxo,
            Hex.from(redeemerOutputScript),
            tbtcBalanceOfDepositor
          )

          console.log(
            `Requested redemption of ${tbtcBalanceOfDepositor} TBTC tokens to script ${redeemerOutputScript} on the bridge`
          )

          redemptionRequest = await maintainerBridgeHandle.pendingRedemptions(
            systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
            Hex.from(redeemerOutputScript)
          )
        })

        it("should unmint depositor's TBTC tokens", async () => {
          const tbtcBalance = await tbtc.balanceOf(
            systemTestsContext.depositor.address
          )

          expect(tbtcBalance).to.be.equal(0)
        })

        it("should transfer vault's bank balance to the Bridge", async () => {
          expect(await bank.balanceOf(vaultAddress)).to.be.equal(0)

          expect(await bank.balanceOf(bridgeAddress)).to.be.equal(
            requestedAmount
          )
        })

        it("should register the redemption request on the bridge", async () => {
          expect(redemptionRequest.requestedAt).to.be.greaterThan(0)
          expect(redemptionRequest.requestedAmount).to.be.equal(requestedAmount)
          expect(redemptionRequest.redeemerOutputScript).to.be.equal(
            redeemerOutputScript
          )
        })

        context(
          "when redemption is made and redemption proof submitted",
          () => {
            let redemptionTxHash: BitcoinTxHash

            before(
              "make the redemption and submit redemption proof",
              async () => {
                ;({
                  transactionHash: redemptionTxHash,
                  newMainUtxo: redemptionUtxo,
                } = await walletTx.redemption.submitTransaction(
                  systemTestsContext.walletBitcoinKeyPair.wif,
                  sweepUtxo,
                  [redemptionRequest.redeemerOutputScript]
                ))

                console.log(
                  "Redemption made on Bitcoin chain:\n" +
                    `- Transaction hash: ${redemptionTxHash}`
                )

                await waitTransactionConfirmed(electrumClient, redemptionTxHash)

                await fakeRelayDifficulty(
                  relay,
                  electrumClient,
                  redemptionTxHash
                )

                await maintenanceService.spv.submitRedemptionProof(
                  redemptionTxHash,
                  sweepUtxo,
                  systemTestsContext.walletBitcoinKeyPair.publicKey.compressed
                )

                console.log("Redemption proved on the bridge")
              }
            )

            it("should broadcast the redemption transaction on the Bitcoin network", async () => {
              expect(
                (await electrumClient.getRawTransaction(redemptionTxHash))
                  .transactionHex.length
              ).to.be.greaterThan(0)
            })

            it("should close the redemption request on the bridge", async () => {
              await expect(
                maintainerBridgeHandle.pendingRedemptions(
                  systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
                  redemptionRequest.redeemerOutputScript
                )
              ).to.be.rejectedWith(
                "Provided redeemer output script and wallet public key do not identify a redemption request"
              )
            })

            it("should decrease Bridge's balance in the bank", async () => {
              const actualBalance = await bank.balanceOf(bridgeAddress)

              expect(actualBalance).to.be.equal(0)
            })
          }
        )
      })
    })
  })
})
