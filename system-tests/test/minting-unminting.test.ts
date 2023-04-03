import {
  TBTC,
  SpvMaintainer,
  ElectrumClient,
  EthereumAddress,
  EthereumBridge,
  BitcoinTransactionHash,
} from "@keep-network/tbtc-v2.ts/dist/src"
import { computeHash160 } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"
import { BigNumber, constants, Contract, utils as ethersUtils } from "ethers"
import chai, { expect } from "chai"
import { submitDepositTransaction } from "@keep-network/tbtc-v2.ts/dist/src/deposit"
import { submitDepositSweepTransaction } from "@keep-network/tbtc-v2.ts/dist/src/deposit-sweep"
import { submitRedemptionTransaction } from "@keep-network/tbtc-v2.ts/dist/src/redemption"
import chaiAsPromised from "chai-as-promised"

import { setupSystemTestsContext } from "./utils/context"
import { generateDeposit } from "./utils/deposit"
import { fakeRelayDifficulty, waitTransactionConfirmed } from "./utils/bitcoin"

import type { UnspentTransactionOutput } from "@keep-network/tbtc-v2.ts/dist/src/bitcoin"
import type { SystemTestsContext } from "./utils/context"
import type { RedemptionRequest } from "@keep-network/tbtc-v2.ts/dist/src/redemption"
import type { Deposit } from "@keep-network/tbtc-v2.ts/dist/src/deposit"

chai.use(chaiAsPromised)

// Converts satoshi to TBTC token units
const satoshiMultiplier = 1e10

/**
 * This system test scenario mints TBTC by depositing into the TBTCVault
 * and use the TBTC token approve-and-call mechanism to unmint and redeem
 * deposited BTC.
 *
 * The scenario consists of the following steps:
 * 1. The depositor broadcasts the deposit transaction on BTC chain and reveals
 *    it to the bridge by pointing TBTCVault as the target vault.
 * 2. The wallet broadcasts the sweep transaction of the given deposit on BTC
 *    chain and submits the sweep proof to the bridge.
 * 3. The depositor (redeemer) uses the TBTC token approve-and-call mechanism
 *    to unmint their token balance and redeem deposited BTC.
 * 4. The wallet broadcasts the redemption transaction handling the given
 *    request and submits the redemption proof to the bridge.
 *
 * Following prerequisites must be fulfilled to make a successful pass:
 * - The depositor's BTC balance must allow to perform the deposit
 * - tBTC v2 contracts must be deployed on used Ethereum network
 * - A fresh live wallet (with no main UTXO yet) must be registered in
 *   the bridge
 */
describe("System Test - Minting and unminting", () => {
  let systemTestsContext: SystemTestsContext
  let electrumClient: ElectrumClient
  let bridgeAddress: string
  let maintainerBridgeHandle: EthereumBridge
  let depositorBridgeHandle: EthereumBridge
  let bank: Contract
  let relay: Contract
  let tbtcVault: Contract
  let tbtcToken: Contract

  const depositAmount = BigNumber.from(2000000)
  const depositSweepTxFee = BigNumber.from(10000)
  // Number of retries for Electrum requests.
  const ELECTRUM_RETRIES = 5
  // Initial backoff step in milliseconds that will be increased exponentially for
  // subsequent Electrum retry attempts.
  const ELECTRUM_RETRY_BACKOFF_STEP_MS = 10000 // 10sec

  let deposit: Deposit
  let depositUtxo: UnspentTransactionOutput
  let sweepUtxo: UnspentTransactionOutput

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

    bridgeAddress = deployedContracts.Bridge.address

    maintainerBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signerOrProvider: maintainer,
    })

    depositorBridgeHandle = new EthereumBridge({
      address: bridgeAddress,
      signerOrProvider: depositor,
    })

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

    const tbtcVaultDeploymentInfo = deployedContracts.TBTCVault
    tbtcVault = new Contract(
      tbtcVaultDeploymentInfo.address,
      tbtcVaultDeploymentInfo.abi,
      maintainer
    )

    const tbtcTokenDeploymentInfo = deployedContracts.TBTC
    tbtcToken = new Contract(
      tbtcTokenDeploymentInfo.address,
      tbtcTokenDeploymentInfo.abi,
      maintainer
    )
  })

  context(
    "when minting is initiated by making and revealing a deposit to the TBTCVault",
    () => {
      before("make and reveal deposit", async () => {
        deposit = generateDeposit(
          systemTestsContext.depositor.address,
          depositAmount,
          systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
          tbtcVault.address // Set TBTCVault as target vault
        )

        console.log(`
        Generated deposit data:
        ${JSON.stringify(deposit)}
      `)
        ;({ depositUtxo } = await submitDepositTransaction(
          deposit,
          systemTestsContext.depositorBitcoinKeyPair.wif,
          electrumClient,
          true
        ))

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
          depositorBridgeHandle,
          deposit.vault
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
        const { revealedAt } = await TBTC.getRevealedDeposit(
          depositUtxo,
          maintainerBridgeHandle
        )
        expect(revealedAt).to.be.greaterThan(0)
      })

      it("should set TBTCVault as target vault of the revealed deposit", async () => {
        const { vault } = await TBTC.getRevealedDeposit(
          depositUtxo,
          maintainerBridgeHandle
        )
        expect(
          EthereumAddress.from(tbtcVault.address).identifierHex
        ).to.be.equal(vault?.identifierHex)
      })

      context("when deposit is swept and sweep proof submitted", () => {
        before("sweep the deposit and submit sweep proof", async () => {
          ;({ newMainUtxo: sweepUtxo } = await submitDepositSweepTransaction(
            electrumClient,
            depositSweepTxFee,
            systemTestsContext.walletBitcoinKeyPair.wif,
            true,
            [depositUtxo],
            [deposit]
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
          await SpvMaintainer.submitDepositSweepProof(
            sweepUtxo.transactionHash,
            // This is the first sweep of the given wallet so there is no main UTXO.
            {
              // The function expects an unprefixed hash.
              transactionHash: BitcoinTransactionHash.from(constants.HashZero),
              outputIndex: 0,
              value: BigNumber.from(0),
            },
            maintainerBridgeHandle,
            electrumClient,
            EthereumAddress.from(tbtcVault.address) // Pass the TBTCVault address for the SPV proof
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
          const { sweptAt } = await TBTC.getRevealedDeposit(
            depositUtxo,
            maintainerBridgeHandle
          )
          expect(sweptAt).to.be.greaterThan(0)
        })

        it("should increase TBTCVault's balance in the bank", async () => {
          const { treasuryFee } = await TBTC.getRevealedDeposit(
            depositUtxo,
            maintainerBridgeHandle
          )

          const expectedBalance = depositAmount
            .sub(treasuryFee)
            .sub(depositSweepTxFee)

          const actualBalance = await bank.balanceOf(tbtcVault.address)

          expect(actualBalance).to.be.equal(expectedBalance)
        })

        it("should mint TBTC to the depositor", async () => {
          const { treasuryFee } = await TBTC.getRevealedDeposit(
            depositUtxo,
            maintainerBridgeHandle
          )

          const expectedMintedAmount = depositAmount
            .sub(treasuryFee)
            .sub(depositSweepTxFee)
            .mul(satoshiMultiplier) // The minted balance is expected to be 1e18

          const actualMintedAmount = await tbtcToken.balanceOf(
            systemTestsContext.depositor.address
          )

          expect(actualMintedAmount).to.be.equal(expectedMintedAmount)
        })

        context("when unminting is done", () => {
          let unmintedAmount: BigNumber
          let redeemerOutputScript: string
          let redemptionRequest: RedemptionRequest

          before("do unminting through TBTC approve-and-call", async () => {
            // Unmint all depositor's TBTC tokens.
            unmintedAmount = await tbtcToken.balanceOf(
              systemTestsContext.depositor.address
            )

            // Request redemption to depositor's address.
            redeemerOutputScript = `0014${computeHash160(
              systemTestsContext.depositorBitcoinKeyPair.publicKey.compressed
            )}`

            // Convert the redeemer output script to a byte buffer.
            const rawRedeemerOutputScript = Buffer.from(
              redeemerOutputScript,
              "hex"
            )

            const redemptionData = ethersUtils.defaultAbiCoder.encode(
              ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
              [
                systemTestsContext.depositor.address,
                `0x${deposit.walletPublicKeyHash}`,
                sweepUtxo.transactionHash.reverse().toPrefixedString(),
                sweepUtxo.outputIndex,
                sweepUtxo.value.toNumber(),
                `0x${Buffer.concat([
                  Buffer.from([rawRedeemerOutputScript.length]),
                  rawRedeemerOutputScript,
                ]).toString("hex")}`,
              ]
            )

            // TODO: Consider moving the heavy lifting related to this call
            //       to the `tbtc-v2.ts` library.
            await tbtcToken
              .connect(systemTestsContext.depositor)
              .approveAndCall(tbtcVault.address, unmintedAmount, redemptionData)

            console.log(
              `Unminted ${unmintedAmount} TBTC and requested redemption to script ${redeemerOutputScript} on the bridge`
            )

            redemptionRequest = await TBTC.getRedemptionRequest(
              systemTestsContext.walletBitcoinKeyPair.publicKey.compressed,
              redeemerOutputScript,
              "pending",
              maintainerBridgeHandle
            )
          })

          it("should burn depositor's TBTC tokens", async () => {
            expect(
              await tbtcToken.balanceOf(systemTestsContext.depositor.address)
            ).to.be.equal(0)
          })

          it("should transfer TBTCVault's bank balance to the Bridge", async () => {
            expect(await bank.balanceOf(tbtcVault.address)).to.be.equal(0)
            expect(await bank.balanceOf(bridgeAddress)).to.be.equal(
              unmintedAmount.div(satoshiMultiplier)
            )
          })

          it("should register the redemption request on the bridge", async () => {
            expect(redemptionRequest.requestedAt).to.be.greaterThan(0)
            expect(redemptionRequest.requestedAmount).to.be.equal(
              unmintedAmount.div(satoshiMultiplier)
            )
            expect(redemptionRequest.redeemerOutputScript).to.be.equal(
              redeemerOutputScript
            )
          })

          context(
            "when redemption is made and redemption proof submitted",
            () => {
              let redemptionTxHash: BitcoinTransactionHash

              before(
                "make the redemption and submit redemption proof",
                async () => {
                  ;({ transactionHash: redemptionTxHash } =
                    await submitRedemptionTransaction(
                      electrumClient,
                      maintainerBridgeHandle,
                      systemTestsContext.walletBitcoinKeyPair.wif,
                      sweepUtxo,
                      [redemptionRequest.redeemerOutputScript],
                      true
                    ))

                  console.log(
                    "Redemption made on Bitcoin chain:\n" +
                      `- Transaction hash: ${redemptionTxHash}`
                  )

                  await waitTransactionConfirmed(
                    electrumClient,
                    redemptionTxHash
                  )

                  await fakeRelayDifficulty(
                    relay,
                    electrumClient,
                    redemptionTxHash
                  )

                  await SpvMaintainer.submitRedemptionProof(
                    redemptionTxHash,
                    sweepUtxo,
                    systemTestsContext.walletBitcoinKeyPair.publicKey
                      .compressed,
                    maintainerBridgeHandle,
                    electrumClient
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
                  TBTC.getRedemptionRequest(
                    systemTestsContext.walletBitcoinKeyPair.publicKey
                      .compressed,
                    redemptionRequest.redeemerOutputScript,
                    "pending",
                    maintainerBridgeHandle
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
    }
  )
})
