/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

import { task, types } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { Bridge } from "../typechain"

interface UTXO {
  txHash: string
  txOutputIndex: number
  txOutputValue: number
}

task("dapp:register-wallet", "Registers the new mocked ECDSA wallet")
  .addParam(
    "utxoTxHash",
    "Hash of the transaction the output belongs to",
    undefined,
    types.string
  )
  .addParam(
    "utxoTxOutputIndex",
    "Index of the transaction output (0-indexed)",
    undefined,
    types.int
  )
  .addParam(
    "utxoTxOutputValue",
    "Value of the transaction output",
    undefined,
    types.int
  )
  .setAction(async (args, hre) => {
    const { utxoTxHash, utxoTxOutputIndex, utxoTxOutputValue } = args
    await registerWallet(hre, {
      txHash: utxoTxHash,
      txOutputIndex: utxoTxOutputIndex,
      txOutputValue: utxoTxOutputValue,
    })
  })

task("dapp:submit-deposit-sweep-proof", "Sweeps a deposit")
  .addParam(
    "walletPubKeyHash",
    "20-byte wallet public key hash.",
    undefined,
    types.string
  )
  .addParam(
    "fundingTxHash",
    "Funding transaction hash. Emitted in the `DepositRevealed` event.",
    undefined,
    types.string
  )
  .addParam(
    "fundingOutputIndex",
    "Index of the funding output belonging to the funding transaction. Emitted in the `DepositRevealed` event.",
    undefined,
    types.int
  )
  .setAction(async (args, hre) => {
    const { walletPubKeyHash, fundingTxHash, fundingOutputIndex } = args
    await submitDepositSweepProof(
      hre,
      walletPubKeyHash,
      fundingTxHash,
      fundingOutputIndex
    )
  })

task("dapp:submit-redemption-proof", "Submits a redemption proof")
  .addParam(
    "walletPubKeyHash",
    "20-byte wallet public key hash.",
    undefined,
    types.string
  )
  .addParam(
    "redeemerOutputScript",
    "The redeemer's length-prefixed output script (P2PKH, P2WPKH, P2SH or P2WSH) that will be used to lock redeemed BTC. Emitted in the `RedemptionRequested` event",
    undefined,
    types.string
  )
  .setAction(async (args, hre) => {
    const { walletPubKeyHash, redeemerOutputScript } = args
    await submitRedemptionProof(hre, walletPubKeyHash, redeemerOutputScript)
  })

task(
  "dapp:get-revealed-deposits",
  "Returns the revealed deposits by depositor address."
)
  .addParam("depositorAddress", "Depositor address", undefined, types.string)
  .setAction(async (args, hre) => {
    const { depositorAddress } = args
    await getRevealedDeposits(hre, depositorAddress)
  })

task(
  "dapp:get-redemptions",
  "Returns the requested redemptions by redeemer address."
)
  .addParam("redeemerAddress", "Redeemer address", undefined, types.string)
  .setAction(async (args, hre) => {
    const { redeemerAddress } = args
    await getRedemptions(hre, redeemerAddress)
  })

async function registerWallet(hre: HardhatRuntimeEnvironment, utxo: UTXO) {
  const { ethers, helpers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")
  const walletRegistry = await helpers.contracts.getContract("WalletRegistry")

  const ecdsaID = ethers.utils.randomBytes(32)
  const publicKeyX = ethers.utils.randomBytes(32)
  const publicKeyY = ethers.utils.randomBytes(32)

  const ecdsaTx = await walletRegistry.mock__createWallet(
    ecdsaID,
    publicKeyX,
    publicKeyY
  )
  await ecdsaTx.wait()
  const walletPublicKey = await walletRegistry.getWalletPublicKey(ecdsaID)
  console.log(`Created wallet with public key ${walletPublicKey}`)

  const finalUtxo = {
    ...utxo,
    // The Ethereum Bridge expects this hash to be in the Bitcoin internal
    // byte order.
    txHash: `0x${Buffer.from(utxo.txHash.slice(2), "hex")
      .reverse()
      .toString("hex")}`,
  }
  const bridgeTx = await bridge.mock__registerEcdsaWallet(
    ecdsaID,
    publicKeyX,
    publicKeyY,
    finalUtxo
  )
  await bridgeTx.wait()
  const walletPublicKeyHash = await bridge.activeWalletPubKeyHash()
  console.log(`Created wallet with public key hash ${walletPublicKeyHash}`)
}

async function submitDepositSweepProof(
  hre: HardhatRuntimeEnvironment,
  walletPubKeyHash: string,
  fundingTxHash: string,
  fundingOutputIndex: number
) {
  const { helpers, ethers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")

  const tx = await bridge.mock__submitDepositSweepProof(
    walletPubKeyHash,
    fundingTxHash,
    fundingOutputIndex
  )
  await tx.wait()

  const depositKey = ethers.utils.solidityKeccak256(
    ["bytes32", "uint32"],
    [fundingTxHash, fundingOutputIndex]
  )

  const deposit = await bridge.deposits(depositKey)

  console.log("Deposit swept successfully at: ", deposit.sweptAt.toString())
}

async function submitRedemptionProof(
  hre: HardhatRuntimeEnvironment,
  walletPubKeyHash: string,
  redeemerOutputScript: string
) {
  const { helpers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")

  const tx = await bridge.mock__submitRedemptionProof(
    walletPubKeyHash,
    redeemerOutputScript
  )
  await tx.wait()

  console.log("Redemptions completed")
}

async function getRevealedDeposits(
  hre: HardhatRuntimeEnvironment,
  depositorAddress: string
) {
  const { helpers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")
  const filter = bridge.filters.DepositRevealed(
    undefined,
    undefined,
    depositorAddress
  )

  const events = (await bridge.queryFilter(filter)).map((event) => ({
    ...event.args,
  }))
  console.table(events, [
    "walletPubKeyHash",
    "fundingTxHash",
    "fundingOutputIndex",
  ])
}

async function getRedemptions(
  hre: HardhatRuntimeEnvironment,
  redeemerAddress: string
) {
  const { helpers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")
  const filter = bridge.filters.RedemptionRequested(
    undefined,
    undefined,
    redeemerAddress
  )

  const events = (await bridge.queryFilter(filter)).map((event) => ({
    ...event.args,
  }))
  console.table(events, ["walletPubKeyHash", "redeemerOutputScript"])
}
