import {
  Transaction,
  Stack,
  Signer,
  payments,
  address,
  script,
  networks,
} from "bitcoinjs-lib"
import { BigNumber } from "ethers"
import {
  RawTransaction,
  UnspentTransactionOutput,
  Client as BitcoinClient,
  decomposeRawTransaction,
  isCompressedPublicKey,
  addressFromKeyPair,
  TransactionHash,
  computeHash160,
  isP2PKHScript,
  isP2WPKHScript,
  isP2SHScript,
  isP2WSHScript,
} from "./bitcoin"
import { assembleDepositScript, Deposit } from "./deposit"
import { Bridge, Identifier } from "./chain"
import { assembleTransactionProof } from "./proof"
import { ECPairFactory } from "ecpair"
import * as tinysecp from "tiny-secp256k1"
import { BitcoinNetwork, toBitcoinJsLibNetwork } from "./bitcoin-network"

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

  const bitcoinNetwork = await bitcoinClient.getNetwork()

  const { transactionHash, newMainUtxo, rawTransaction } =
    await assembleDepositSweepTransaction(
      bitcoinNetwork,
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
 * Constructs a Bitcoin deposit sweep transaction using provided UTXOs.
 * @dev The caller is responsible for ensuring the provided UTXOs are correctly
 *      formed, can be spent by the wallet and their combined value is greater
 *      then the fee.
 * @param bitcoinNetwork - The target Bitcoin network (mainnet or testnet).
 * @param fee - Transaction fee to be subtracted from the sum of the UTXOs'
 *        values.
 * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
 * @param witness - Determines the type of the new main UTXO output: P2WPKH if
 *        `true`, P2PKH if `false`.
 * @param utxos - UTXOs from new deposit transactions. Must be P2(W)SH.
 * @param deposits - Deposit data corresponding to each UTXO. The number of
 *        UTXOs and deposits must match.
 * @param mainUtxo - The wallet's main UTXO (optional), which is a P2(W)PKH UTXO
 *        from a previous transaction.
 * @returns An object containing the sweep transaction hash, new wallet's main
 *          UTXO, and the raw deposit sweep transaction representation.
 * @throws Error if the provided UTXOs and deposits mismatch or if an unsupported
 *         UTXO script type is encountered.
 */
export async function assembleDepositSweepTransaction(
  bitcoinNetwork: BitcoinNetwork,
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

  const network = toBitcoinJsLibNetwork(bitcoinNetwork)
  // eslint-disable-next-line new-cap
  const keyPair = ECPairFactory(tinysecp).fromWIF(walletPrivateKey, network)
  const walletAddress = addressFromKeyPair(keyPair, network, witness)

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
    transaction.addInput(
      utxo.transactionHash.reverse().toBuffer(),
      utxo.outputIndex
    )
  }

  // Add transaction output.
  const scriptPubKey = address.toOutputScript(walletAddress, network)
  transaction.addOutput(scriptPubKey, totalInputValue.toNumber())

  // Sign the main UTXO input if there is main UTXO.
  if (mainUtxo) {
    const inputIndex = 0 // Main UTXO is the first input.
    const previousOutput = Transaction.fromHex(mainUtxo.transactionHex).outs[
      mainUtxo.outputIndex
    ]

    await signMainUtxoInput(
      transaction,
      inputIndex,
      previousOutput.script,
      previousOutput.value,
      keyPair,
      network
    )
  }

  // Sign the deposit inputs.
  for (let depositIndex = 0; depositIndex < deposits.length; depositIndex++) {
    // If there is a main UTXO index, we must adjust input index as the first
    // input is the main UTXO input.
    const inputIndex = mainUtxo ? depositIndex + 1 : depositIndex

    const utxo = utxos[depositIndex]
    const previousOutput = Transaction.fromHex(utxo.transactionHex).outs[
      utxo.outputIndex
    ]
    const previousOutputValue = previousOutput.value
    const previousOutputScript = previousOutput.script

    const deposit = deposits[depositIndex]

    if (isP2SHScript(previousOutputScript)) {
      // P2SH (deposit UTXO)
      await signP2SHDepositInput(
        transaction,
        inputIndex,
        deposit,
        previousOutputValue,
        keyPair
      )
    } else if (isP2WSHScript(previousOutputScript)) {
      // P2WSH (deposit UTXO)
      await signP2WSHDepositInput(
        transaction,
        inputIndex,
        deposit,
        previousOutputValue,
        keyPair
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

/**
 * Signs the main UTXO transaction input and sets the appropriate script or
 * witness data.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param prevOutScript - The previous output script for the input.
 * @param prevOutValue - The value from the previous transaction output.
 * @param keyPair - A Signer object with the public and private key pair.
 * @param network - The Bitcoin network type (mainnet or testnet).
 * @returns An empty promise upon successful signing.
 * @throws Error if the UTXO doesn't belong to the wallet, or if the script
 *         format is invalid or unknown.
 */
async function signMainUtxoInput(
  transaction: Transaction,
  inputIndex: number,
  prevOutScript: Buffer,
  prevOutValue: number,
  keyPair: Signer,
  network: networks.Network
) {
  if (!ownsUtxo(keyPair, prevOutScript, network)) {
    throw new Error("UTXO does not belong to the wallet")
  }

  const sigHashType = Transaction.SIGHASH_ALL

  if (isP2PKHScript(prevOutScript)) {
    // P2PKH
    const sigHash = transaction.hashForSignature(
      inputIndex,
      prevOutScript,
      sigHashType
    )

    const signature = script.signature.encode(
      keyPair.sign(sigHash),
      sigHashType
    )

    const scriptSig = payments.p2pkh({
      signature: signature,
      pubkey: keyPair.publicKey,
    }).input!

    transaction.ins[inputIndex].script = scriptSig
  } else if (isP2WPKHScript(prevOutScript)) {
    // P2WPKH
    const decompiledScript = script.decompile(prevOutScript)
    if (
      !decompiledScript ||
      decompiledScript.length !== 2 ||
      decompiledScript[0] !== 0x00 ||
      !Buffer.isBuffer(decompiledScript[1]) ||
      decompiledScript[1].length !== 20
    ) {
      throw new Error("Invalid script format")
    }

    const publicKeyHash = decompiledScript[1]
    const p2pkhScript = payments.p2pkh({ hash: publicKeyHash }).output!

    const sigHash = transaction.hashForWitnessV0(
      inputIndex,
      p2pkhScript,
      prevOutValue,
      sigHashType
    )

    const signature = script.signature.encode(
      keyPair.sign(sigHash),
      sigHashType
    )

    transaction.ins[inputIndex].witness = [signature, keyPair.publicKey]
  } else {
    throw new Error("Unknown type of main UTXO")
  }
}

/**
 * Signs a P2SH deposit transaction input and sets the `scriptSig`.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param deposit - Details of the deposit transaction.
 * @param prevOutValue - The value from the previous transaction output.
 * @param keyPair - A Signer object with the public and private key pair.
 * @returns An empty promise upon successful signing.
 */
async function signP2SHDepositInput(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  prevOutValue: number,
  keyPair: Signer
) {
  const { walletPublicKey, depositScript } = await prepareInputSignData(
    deposit,
    prevOutValue,
    keyPair
  )

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForSignature(
    inputIndex,
    depositScript,
    sigHashType
  )

  const signature = script.signature.encode(keyPair.sign(sigHash), sigHashType)

  const scriptSig: Stack = []
  scriptSig.push(signature)
  scriptSig.push(Buffer.from(walletPublicKey, "hex"))
  scriptSig.push(depositScript)

  transaction.ins[inputIndex].script = script.compile(scriptSig)
}

/**
 * Signs a P2WSH deposit transaction input and sets the witness script.
 * @param transaction - The transaction containing the input to be signed.
 * @param inputIndex - Index pointing to the input within the transaction.
 * @param deposit - Details of the deposit transaction.
 * @param prevOutValue - The value from the previous transaction output.
 * @param keyPair - A Signer object with the public and private key pair.
 * @returns An empty promise upon successful signing.
 */
async function signP2WSHDepositInput(
  transaction: Transaction,
  inputIndex: number,
  deposit: Deposit,
  prevOutValue: number,
  keyPair: Signer
) {
  const { walletPublicKey, depositScript, previousOutputValue } =
    await prepareInputSignData(deposit, prevOutValue, keyPair)

  const sigHashType = Transaction.SIGHASH_ALL

  const sigHash = transaction.hashForWitnessV0(
    inputIndex,
    depositScript,
    previousOutputValue,
    sigHashType
  )

  const signature = script.signature.encode(keyPair.sign(sigHash), sigHashType)

  const witness: Buffer[] = []
  witness.push(signature)
  witness.push(Buffer.from(walletPublicKey, "hex"))
  witness.push(depositScript)

  transaction.ins[inputIndex].witness = witness
}

/**
 * Prepares data for signing a deposit transaction input.
 * @param deposit - The deposit details.
 * @param prevOutValue - The value from the previous transaction output.
 * @param ecPair - A Signer object with the public and private key pair.
 * @returns A Promise resolving to:
 * - walletPublicKey: Hexstring representation of the wallet's public key.
 * - depositScript: Buffer containing the assembled deposit script.
 * - previousOutputValue: Numeric value of the prior transaction output.
 * @throws Error if there are discrepancies in values or key formats.
 */
async function prepareInputSignData(
  deposit: Deposit,
  prevOutValue: number,
  ecPair: Signer
): Promise<{
  walletPublicKey: string
  depositScript: any
  previousOutputValue: number
}> {
  if (prevOutValue != deposit.amount.toNumber()) {
    throw new Error("Mismatch between amount in deposit and deposit tx")
  }

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

/**
 * Checks if a UTXO is owned by a provided key pair based on its previous output
 * script.
 * @dev The function assumes previous output script comes form the P2PKH or
 *      P2WPKH UTXO.
 * @param keyPair - A Signer object containing the public key and private key
 *        pair.
 * @param prevOutScript - A Buffer containing the previous output script of the
 *        UTXO.
 * @param network - The Bitcoin network configuration, i.e. mainnet or testnet.
 * @returns A boolean indicating whether the derived address from the UTXO's
 *          previous output script matches either of the P2PKH or P2WPKH
 *          addresses derived from the provided key pair.
 */
export function ownsUtxo(
  keyPair: Signer,
  prevOutScript: Buffer,
  network: networks.Network
): boolean {
  // Derive P2PKH and P2WPKH addresses from the public key.
  const p2pkhAddress =
    payments.p2pkh({ pubkey: keyPair.publicKey, network }).address || ""
  const p2wpkhAddress =
    payments.p2wpkh({ pubkey: keyPair.publicKey, network }).address || ""

  // Try to extract an address from the provided prevOutScript.
  let addressFromOutput = ""
  try {
    addressFromOutput =
      payments.p2pkh({ output: prevOutScript, network }).address || ""
  } catch (e) {
    // If not P2PKH, try P2WPKH.
    try {
      addressFromOutput =
        payments.p2wpkh({ output: prevOutScript, network }).address || ""
    } catch (err) {
      // If neither p2pkh nor p2wpkh address can be derived, assume the previous
      // output script comes from a different UTXO type or is corrupted.
      return false
    }
  }

  // Check if the UTXO's address matches either of the derived addresses.
  return (
    addressFromOutput === p2pkhAddress || addressFromOutput === p2wpkhAddress
  )
}
