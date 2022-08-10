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

async function registerWallet(hre: HardhatRuntimeEnvironment, utxo: UTXO) {
  const { ethers, helpers } = hre
  const bridge = await helpers.contracts.getContract<Bridge>("Bridge")

  const ecdsaID = ethers.utils.randomBytes(32)
  const publicKeyX = ethers.utils.randomBytes(32)
  const publicKeyY = ethers.utils.randomBytes(32)

  await bridge.mock__registerEcdsaWallet(ecdsaID, publicKeyX, publicKeyY, utxo)

  const walletPublicKey = await bridge.activeWalletPubKeyHash()

  console.log(`Created wallet with public key ${walletPublicKey}`)
}
