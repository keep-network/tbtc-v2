/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */

import { task, types } from "hardhat/config"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { Bridge, TBTCVault } from "../typechain"

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
  .addParam(
    "redemptionTxHash",
    "Hash of the redemption transaction on the Bitcoin chain.",
    undefined,
    types.string
  )
  .setAction(async (args, hre) => {
    const { walletPubKeyHash, redeemerOutputScript, redemptionTxHash } = args
    await submitRedemptionProof(
      hre,
      walletPubKeyHash,
      redeemerOutputScript,
      redemptionTxHash
    )
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

task("dapp:set-vault-status", "Sets vault status")
  .addParam("address", "Address of the vault.", undefined, types.string)
  .addParam(
    "isTrusted",
    "Sets the vault status as trusted if true, otherwise it's not trusted",
    undefined,
    types.boolean
  )
  .setAction(async (args, hre) => {
    const { address, isTrusted } = args
    await setVaultStatus(hre, address, isTrusted)
  })

task("dapp:add-minter", "Adds new minter")
  .addParam(
    "address",
    "Address that will be set as minter.",
    undefined,
    types.string
  )
  .setAction(async (args, hre) => {
    const { address } = args
    await addMinter(hre, address)
  })

task("dapp:request-optimistic-minting", "Requests optimistc minting")
  .addParam(
    "fundingTxHash",
    "Funding transaction hash.",
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
    const { fundingTxHash, fundingOutputIndex } = args
    await requestOptimisticMint(hre, fundingTxHash, fundingOutputIndex)
  })

task("dapp:finalize-optimistic-minting", "Finalizes optimistc minting")
  .addParam(
    "fundingTxHash",
    "Funding transaction hash.",
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
    const { fundingTxHash, fundingOutputIndex } = args
    await finalizeOptimisticMint(hre, fundingTxHash, fundingOutputIndex)
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
  redeemerOutputScript: string,
  redemptionTxHash: string
) {
  const { helpers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")

  const tx = await bridge.mock__submitRedemptionProof(
    walletPubKeyHash,
    redeemerOutputScript,
    redemptionTxHash
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

async function setVaultStatus(
  hre: HardhatRuntimeEnvironment,
  address: string,
  isTrusted: boolean
) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  await execute(
    "BridgeGovernance",
    { from: deployer, log: true, waitConfirmations: 1 },
    "setVaultStatus",
    address,
    isTrusted
  )

  console.log(`Vault (${address}) is now ${!isTrusted ? "NOT" : ""} trusted!`)
}

async function addMinter(hre: HardhatRuntimeEnvironment, address: string) {
  const { getNamedAccounts, deployments, helpers } = hre
  const { execute } = deployments
  const { deployer } = await getNamedAccounts()

  await execute(
    "TBTCVault",
    { from: deployer, log: true, waitConfirmations: 1 },
    "addMinter",
    address
  )

  console.log(`Successfully added minter: ${address}!`)
}

async function requestOptimisticMint(
  hre: HardhatRuntimeEnvironment,
  fundingTxHash: string,
  fundingOutputIndex: number
) {
  const { helpers } = hre
  const tbtcVault = await helpers.contracts.getContract<TBTCVault>("TBTCVault")

  const tx = await tbtcVault.requestOptimisticMint(
    fundingTxHash,
    fundingOutputIndex
  )
  await tx.wait()

  console.log(
    `Optimistic Minting requested successfuly for a deposit with tx hash ${fundingTxHash}!`
  )
}

async function finalizeOptimisticMint(
  hre: HardhatRuntimeEnvironment,
  fundingTxHash: string,
  fundingOutputIndex: number
) {
  const { helpers, ethers } = hre
  const tbtcVault = await helpers.contracts.getContract<TBTCVault>("TBTCVault")

  const tx = await tbtcVault.finalizeOptimisticMint(
    fundingTxHash,
    fundingOutputIndex
  )
  await tx.wait()

  console.log(
    `Finalized Optimistic Minting for a deposit with tx hash ${fundingTxHash}!`
  )
}
