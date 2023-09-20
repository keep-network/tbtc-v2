import bcoin from "bcoin"
import { Transaction, Stack, address, script, networks } from "bitcoinjs-lib"
import { BigNumber } from "ethers"
import {
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
  decomposeRawTransaction,
  isCompressedPublicKey,
  createKeyRing,
  TransactionHash,
  computeHash160,
  isP2PKH,
  isP2WPKH,
  isP2SH,
  isP2WSH,
} from "./bitcoin"
import { assembleDepositScript, Deposit } from "./deposit"
import { Bridge, Identifier } from "./chain"
import { assembleTransactionProof } from "./proof"
import { ECPairFactory as ecFactory, ECPairInterface } from "ecpair"
import * as tinysecp from "tiny-secp256k1"

/**
 * Submits a deposit sweep by combining all the provided P2(W)SH UTXOs and
 * broadcasting a Bitcoin P2(W)PKH deposit sweep transaction.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee. Note that broadcasting transaction may fail silently (e.g.
 *      when the provided UTXOs are not spendable) and no error will be returned.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *        values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
 * @param witness - The parameter used to decide about the type of the new main
 *        UTXO output. P2WPKH if `true`, P2PKH if `false`.
 * @param utxos - P2(W)SH UTXOs to be combined into one output.
 * @param deposits - Array of deposits. Each element corresponds to UTXO.
 *        The number of UTXOs and deposit elements must equal.
 * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
 *        from the previous wallet transaction (optional).
 * @returns The outcome consisting of:
 *          - the sweep transaction hash,
 *          - the new wallet's main UTXO produced by this transaction.
 */
export async function submitDepositSweepTransaction(
  bitcoinClient: BitcoinClient,
  fee: BigNumber,
  walletPrivateKey: string,
  witness: boolean,
  utxos: UnspentTransactionOutput[],
  deposits: Deposit[],
  mainUtxo?: UnspentTransactionOutput
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo: UnspentTransactionOutput
}> {
  const utxosWithRaw: (UnspentTransactionOutput & RawTransaction)[] = []
  for (const utxo of utxos) {
    const utxoRawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    utxosWithRaw.push({
      ...utxo,
      transactionHex: utxoRawTransaction.transactionHex,
    })
  }

  let mainUtxoWithRaw

  if (mainUtxo) {
    const mainUtxoRawTransaction = await bitcoinClient.getRawTransaction(
      mainUtxo.transactionHash
    )
    mainUtxoWithRaw = {
      ...mainUtxo,
      transactionHex: mainUtxoRawTransaction.transactionHex,
    }
  }

  const { transactionHash, newMainUtxo, rawTransaction } =
    await assembleDepositSweepTransaction(
      fee,
      walletPrivateKey,
      witness,
      utxosWithRaw,
      deposits,
      mainUtxoWithRaw
    )

  // Note that `broadcast` may fail silently (i.e. no error will be returned,
  // even if the transaction is rejected by other nodes and does not enter the
  // mempool, for example due to an UTXO being already spent).
  await bitcoinClient.broadcast(rawTransaction)

  return { transactionHash, newMainUtxo }
}

/**
 * Assembles a Bitcoin P2WPKH deposit sweep transaction.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *        values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
 * @param witness - The parameter used to decide about the type of the new main
 *        UTXO output. P2WPKH if `true`, P2PKH if `false`.
 * @param utxos - UTXOs from new deposit transactions. Must be P2(W)SH.
 * @param deposits - Array of deposits. Each element corresponds to UTXO.
 *        The number of UTXOs and deposit elements must equal.
 * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
 *        from the previous wallet transaction (optional).
 * @returns The outcome consisting of:
 *          - the sweep transaction hash,
 *          - the new wallet's main UTXO produced by this transaction.
 *          - the sweep transaction in the raw format
 */
export async function assembleDepositSweepTransaction(
  fee: BigNumber,
  walletPrivateKey: string,
  witness: boolean,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  deposits: Deposit[],
  mainUtxo?: UnspentTransactionOutput & RawTransaction
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo: UnspentTransactionOutput
  rawTransaction: RawTransaction
}> {
  if (utxos.length < 1) {
    throw new Error("There must be at least one deposit UTXO to sweep")
  }

  if (utxos.length != deposits.length) {
    throw new Error("Number of UTXOs must equal the number of deposit elements")
  }

  const walletKeyRing = createKeyRing(walletPrivateKey, witness)
  const walletAddress = walletKeyRing.getAddress("string")

  const inputCoins = []
  let totalInputValue = BigNumber.from(0)

  if (mainUtxo) {
    inputCoins.push(
      bcoin.Coin.fromTX(
        bcoin.MTX.fromRaw(mainUtxo.transactionHex, "hex"),
        mainUtxo.outputIndex,
        -1
      )
    )
    totalInputValue = totalInputValue.add(mainUtxo.value)
  }

  for (const utxo of utxos) {
    inputCoins.push(
      bcoin.Coin.fromTX(
        bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
        utxo.outputIndex,
        -1
      )
    )
    totalInputValue = totalInputValue.add(utxo.value)
  }

  const transaction = new bcoin.MTX()

  transaction.addOutput({
    script: bcoin.Script.fromAddress(walletAddress),
    value: totalInputValue.toNumber(),
  })

  await transaction.fund(inputCoins, {
    changeAddress: walletAddress,
    hardFee: fee.toNumber(),
    subtractFee: true,
  })

  if (transaction.outputs.length != 1) {
    throw new Error("Deposit sweep transaction must have only one output")
  }

  // UTXOs must be mapped to deposits, as `fund` may arrange inputs in any
  // order
  const utxosWithDeposits: (UnspentTransactionOutput &
    RawTransaction &
    Deposit)[] = utxos.map((utxo, index) => ({
    ...utxo,
    ...deposits[index],
  }))

  for (let i = 0; i < transaction.inputs.length; i++) {
    const previousOutpoint = transaction.inputs[i].prevout
    const previousOutput = transaction.view.getOutput(previousOutpoint)
    const previousScript = previousOutput.script

    // P2(W)PKH (main UTXO)
    if (previousScript.isPubkeyhash() || previousScript.isWitnessPubkeyhash()) {
      await signMainUtxoInput(transaction, i, walletKeyRing)
      continue
    }

    const utxoWithDeposit = utxosWithDeposits.find(
      (u) =>
        u.transactionHash.toString() === previousOutpoint.txid() &&
        u.outputIndex == previousOutpoint.index
    )
    if (!utxoWithDeposit) {
      throw new Error("Unknown input")
    }

    if (previousScript.isScripthash()) {
      // P2SH (deposit UTXO)
      await signP2SHDepositInput(transaction, i, utxoWithDeposit, walletKeyRing)
    } else if (previousScript.isWitnessScripthash()) {
      // P2WSH (deposit UTXO)
      await signP2WSHDepositInput(
        transaction,
        i,
        utxoWithDeposit,
        walletKeyRing
      )
    } else {
      throw new Error("Unsupported UTXO script type")
    }
  }

  const transactionHash = TransactionHash.from(transaction.txid())

  return {
    transactionHash,
    newMainUtxo: {
      transactionHash,
      outputIndex: 0, // There is only one output.
      value: BigNumber.from(transaction.outputs[0].value),
    },
    rawTransaction: {
      transactionHex: transaction.toRaw().toString("hex"),
    },
  }
}

/**
 * Assembles a Bitcoin P2WPKH deposit sweep transaction.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *        values and used as the transaction fee.
 * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
 * @param witness - The parameter used to decide about the type of the new main
 *        UTXO output. P2WPKH if `true`, P2PKH if `false`.
 * @param utxos - UTXOs from new deposit transactions. Must be P2(W)SH.
 * @param deposits - Array of deposits. Each element corresponds to UTXO.
 *        The number of UTXOs and deposit elements must equal.
 * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
 *        from the previous wallet transaction (optional).
 * @returns The outcome consisting of:
 *          - the sweep transaction hash,
 *          - the new wallet's main UTXO produced by this transaction.
 *          - the sweep transaction in the raw format
 */
// TODO: Rename once it's finished.
export async function assembleDepositSweepTransactionBitcoinJsLib(
  fee: BigNumber,
  walletPrivateKey: string,
  witness: boolean,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  deposits: Deposit[],
  mainUtxo?: UnspentTransactionOutput & RawTransaction
): Promise<{
  transactionHash: TransactionHash
  newMainUtxo: UnspentTransactionOutput
  rawTransaction: RawTransaction
}> {
  if (utxos.length < 1) {
    throw new Error("There must be at least one deposit UTXO to sweep")
  }

  if (utxos.length != deposits.length) {
    throw new Error("Number of UTXOs must equal the number of deposit elements")
  }

  // TODO: Replace keyring with bitcoinjs-lib functionalities for managing
  //       keys (ecpair).
  const walletKeyRing = createKeyRing(walletPrivateKey, witness)
  const walletAddress = walletKeyRing.getAddress("string")

  const ecPairApi = ecFactory(tinysecp)
  // TODO: Pass appropriate network type (testnet vs mainnet).
  const ecPair = ecPairApi.fromWIF(walletPrivateKey, networks.testnet)

  // Calculate the value of transaction's output. Note that the value of fee
  // needs to be subtracted from the sum.
  let totalInputValue = BigNumber.from(0)
  if (mainUtxo) {
    totalInputValue = totalInputValue.add(mainUtxo.value)
  }
  for (const utxo of utxos) {
    totalInputValue = totalInputValue.add(utxo.value)
  }
  totalInputValue = totalInputValue.sub(fee)

  // Create the transaction.
  const transaction = new Transaction()

  // Add the transaction's inputs.
  if (mainUtxo) {
    transaction.addInput(
      mainUtxo.transactionHash.reverse().toBuffer(),
      mainUtxo.outputIndex
    )
  }
  for (const utxo of utxos) {
    // TODO: Validate that the utxo's value is the same as the value in deposit
    transaction.addInput(
      utxo.transactionHash.reverse().toBuffer(),
      utxo.outputIndex
    )
  }

  // TODO: Verify that output script is properly created from both testnet
  //       and mainnet addresses.
  // Add transaction output.
  const scriptPubKey = address.toOutputScript(walletAddress)
  transaction.addOutput(scriptPubKey, totalInputValue.toNumber())

  // UTXOs must be mapped to deposits, as `fund` may arrange inputs in any
  // order
  const utxosWithDeposits: (UnspentTransactionOutput &
    RawTransaction &
    Deposit)[] = utxos.map((utxo, index) => ({
    ...utxo,
    ...deposits[index],
  }))

  for (let i = 0; i < transaction.ins.length; i++) {
    const previousOutput = findPreviousOutput(
      TransactionHash.from(transaction.ins[i].hash).reverse(),
      transaction.ins[i].index,
      utxos,
      mainUtxo
    )
    const previousOutputScript = previousOutput.script

    // P2(W)PKH (main UTXO)
    if (isP2PKH(previousOutputScript) || isP2WPKH(previousOutputScript)) {
      signMainUtxoInputBitcoinJsLib(transaction, i, ecPair)
      continue
    }

    const utxoWithDeposit = utxosWithDeposits.find(
      (u) =>
        u.transactionHash.reverse().toString() ===
          transaction.ins[i].hash.toString("hex") &&
        u.outputIndex == transaction.ins[i].index
    )
    if (!utxoWithDeposit) {
      throw new Error("Unknown input")
    }

    if (isP2SH(previousOutputScript)) {
      // P2SH (deposit UTXO)
      await signP2SHDepositInputBitcoinJsLib(
        transaction,
        i,
        utxoWithDeposit,
        ecPair
      )
    } else if (isP2WSH(previousOutputScript)) {
      // P2WSH (deposit UTXO)
      await signP2WSHDepositInputBitcoinJsLib(
        transaction,
        i,
        utxoWithDeposit,
        ecPair
      )
    } else {
      throw new Error("Unsupported UTXO script type")
    }
  }

  const transactionHash = TransactionHash.from(transaction.getId())

  return {
    transactionHash,
    newMainUtxo: {
      transactionHash,
      outputIndex: 0, // There is only one output.
      value: BigNumber.from(transaction.outs[0].value),
    },
    rawTransaction: {
      transactionHex: transaction.toHex(),
    },
  }
}

function findPreviousOutput(
  inputHash: TransactionHash,
  inputIndex: number,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  mainUtxo?: UnspentTransactionOutput & RawTransaction
) {
  if (
    mainUtxo &&
    mainUtxo.transactionHash.equals(inputHash) &&
    mainUtxo.outputIndex === inputIndex
  ) {
    return Transaction.fromHex(mainUtxo.transactionHex).outs[
      mainUtxo.outputIndex
    ]
  }

  for (const utxo of utxos) {
    if (
      utxo.transactionHash.equals(inputHash) &&
      utxo.outputIndex === inputIndex
    ) {
      return Transaction.fromHex(utxo.transactionHex).outs[utxo.outputIndex]
    }
  }

  throw new Error("Unknown input")
}

/**
 * Creates script for the transaction input at the given index and signs the
 * input.
 * @param transaction - Mutable transaction containing the input to be signed.
 * @param inputIndex - Index that points to the input to be signed.
 * @param walletKeyRing - Key ring created using the wallet's private key.
 * @returns Empty promise.
 */
async function signMainUtxoInput(
  transaction: any,
  inputIndex: number,
  walletKeyRing: any
) {
  const previousOutpoint = transaction.inputs[inputIndex].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)
  if (!walletKeyRing.ownOutput(previousOutput)) {
    throw new Error("UTXO does not belong to the wallet")
  }
  // Build script and set it as input's witness
  transaction.scriptInput(inputIndex, previousOutput, walletKeyRing)
  // Build signature and add it in front of script in input's witness
  transaction.signInput(inputIndex, previousOutput, walletKeyRing)
}

/**
 * Creates and sets `scriptSig` for the transaction input at the given index by
 * combining signature, wallet public key and deposit script.
 * @param transaction - Mutable transaction containing the input to be signed.
 * @param inputIndex - Index that points to the input to be signed.
 * @param deposit - Data of the deposit.
 * @param walletKeyRing - Key ring created using the wallet's private key.
 * @returns Empty promise.
 */
async function signP2SHDepositInput(
  transaction: any,
  inputIndex: number,
  deposit: Deposit,
  walletKeyRing: any
): Promise<void> {
  const { walletPublicKey, depositScript, previousOutputValue } =
    await prepareInputSignData(transaction, inputIndex, deposit, walletKeyRing)

  const signature: Buffer = transaction.signature(
    inputIndex,
    depositScript,
    previousOutputValue,
    walletKeyRing.privateKey,
    bcoin.Script.hashType.ALL,
    0 // legacy sighash version
  )
  const scriptSig = new bcoin.Script()
  scriptSig.clear()
  scriptSig.pushData(signature)
  scriptSig.pushData(Buffer.from(walletPublicKey, "hex"))
  scriptSig.pushData(depositScript.toRaw())
  scriptSig.compile()

  transaction.inputs[inputIndex].script = scriptSig
}

/**
 * Creates and sets witness script for the transaction input at the given index
 * by combining signature, wallet public key and deposit script.
 * @param transaction - Mutable transaction containing the input to be signed.
 * @param inputIndex - Index that points to the input to be signed.
 * @param deposit - Data of the deposit.
 * @param walletKeyRing - Key ring created using the wallet's private key.
 * @returns Empty promise.
 */
async function signP2WSHDepositInput(
  transaction: any,
  inputIndex: number,
  deposit: Deposit,
  walletKeyRing: any
): Promise<void> {
  const { walletPublicKey, depositScript, previousOutputValue } =
    await prepareInputSignData(transaction, inputIndex, deposit, walletKeyRing)

  const signature: Buffer = transaction.signature(
    inputIndex,
    depositScript,
    previousOutputValue,
    walletKeyRing.privateKey,
    bcoin.Script.hashType.ALL,
    1 // segwit sighash version
  )

  const witness = new bcoin.Witness()
  witness.clear()
  witness.pushData(signature)
  witness.pushData(Buffer.from(walletPublicKey, "hex"))
  witness.pushData(depositScript.toRaw())
  witness.compile()

  transaction.inputs[inputIndex].witness = witness
}

async function signMainUtxoInputBitcoinJsLib(
  transaction: any,
  inputIndex: number,
  ecPair: ECPairInterface
) {
  // TODO: Implement
}

// TODO: Rename once the function is implemented.
async function signP2SHDepositInputBitcoinJsLib(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  ecPair: ECPairInterface
) {
  const { walletPublicKey, depositScript } =
    await prepareInputSignDataBitcoinIsLib(deposit, ecPair)

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForSignature(
    inputIndex,
    depositScript,
    sigHashType
  )

  const signature = script.signature.encode(ecPair.sign(sigHash), sigHashType)

  const scriptSig: Stack = []
  scriptSig.push(signature)
  scriptSig.push(Buffer.from(walletPublicKey, "hex"))
  scriptSig.push(depositScript)

  transaction.ins[inputIndex].script = script.compile(scriptSig)
}

// TODO: Rename once the function is implemented.
async function signP2WSHDepositInputBitcoinJsLib(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  ecPair: ECPairInterface
) {
  const { walletPublicKey, depositScript, previousOutputValue } =
    await prepareInputSignDataBitcoinIsLib(deposit, ecPair)

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForWitnessV0(
    inputIndex,
    depositScript,
    previousOutputValue,
    sigHashType
  )

  const signature = script.signature.encode(ecPair.sign(sigHash), sigHashType)

  const witness: Buffer[] = []
  witness.push(signature)
  witness.push(Buffer.from(walletPublicKey, "hex"))
  witness.push(depositScript)

  transaction.ins[inputIndex].witness = witness
}

async function prepareInputSignDataBitcoinIsLib(
  deposit: Deposit,
  ecPair: ECPairInterface
): Promise<{
  walletPublicKey: string
  depositScript: any
  previousOutputValue: number
}> {
  const walletPublicKey = ecPair.publicKey.toString("hex")

  if (computeHash160(walletPublicKey) != deposit.walletPublicKeyHash) {
    throw new Error(
      "Wallet public key does not correspond to wallet private key"
    )
  }

  if (!isCompressedPublicKey(walletPublicKey)) {
    throw new Error("Wallet public key must be compressed")
  }

  // eslint-disable-next-line no-unused-vars
  const { amount, vault, ...depositScriptParameters } = deposit

  const depositScript = Buffer.from(
    await assembleDepositScript(depositScriptParameters),
    "hex"
  )

  return {
    walletPublicKey,
    depositScript: depositScript,
    previousOutputValue: deposit.amount.toNumber(),
  }
}

/**
 * Creates data needed to sign a deposit input.
 * @param transaction - Mutable transaction containing the input.
 * @param inputIndex - Index that points to the input.
 * @param deposit - Data of the deposit.
 * @param walletKeyRing - Key ring created using the wallet's private key.
 * @returns Data needed to sign the input.
 */
async function prepareInputSignData(
  transaction: any,
  inputIndex: number,
  deposit: Deposit,
  walletKeyRing: any
): Promise<{
  walletPublicKey: string
  depositScript: any
  previousOutputValue: number
}> {
  const previousOutpoint = transaction.inputs[inputIndex].prevout
  const previousOutput = transaction.view.getOutput(previousOutpoint)

  if (previousOutput.value != deposit.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit and deposit tx")
  }

  const walletPublicKey = walletKeyRing.getPublicKey("hex")
  if (
    computeHash160(walletKeyRing.getPublicKey("hex")) !=
    deposit.walletPublicKeyHash
  ) {
    throw new Error(
      "Wallet public key does not correspond to wallet private key"
    )
  }

  if (!isCompressedPublicKey(walletPublicKey)) {
    throw new Error("Wallet public key must be compressed")
  }

  // eslint-disable-next-line no-unused-vars
  const { amount, vault, ...depositScriptParameters } = deposit

  const depositScript = bcoin.Script.fromRaw(
    Buffer.from(await assembleDepositScript(depositScriptParameters), "hex")
  )

  return {
    walletPublicKey,
    depositScript: depositScript,
    previousOutputValue: previousOutput.value,
  }
}

/**
 * Prepares the proof of a deposit sweep transaction and submits it to the
 * Bridge on-chain contract.
 * @param transactionHash - Hash of the transaction being proven.
 * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
 * @param bridge - Handle to the Bridge on-chain contract.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param vault - (Optional) The vault pointed by swept deposits.
 * @returns Empty promise.
 */
export async function submitDepositSweepProof(
  transactionHash: TransactionHash,
  mainUtxo: UnspentTransactionOutput,
  bridge: Bridge,
  bitcoinClient: BitcoinClient,
  vault?: Identifier
): Promise<void> {
  const confirmations = await bridge.txProofDifficultyFactor()
  const proof = await assembleTransactionProof(
    transactionHash,
    confirmations,
    bitcoinClient
  )
  // TODO: Write a converter and use it to convert the transaction part of the
  // proof to the decomposed transaction data (version, inputs, outputs, locktime).
  // Use raw transaction data for now.
  const rawTransaction = await bitcoinClient.getRawTransaction(transactionHash)
  const decomposedRawTransaction = decomposeRawTransaction(rawTransaction)
  await bridge.submitDepositSweepProof(
    decomposedRawTransaction,
    proof,
    mainUtxo,
    vault
  )
}
