import { BigNumber } from "ethers"
import {
  Psbt,
  Stack,
  Transaction,
  payments,
  script,
  opcodes,
} from "bitcoinjs-lib"
import {
  Client as BitcoinClient,
  createAddressFromPublicKey,
  decomposeRawTransaction,
  RawTransaction,
  UnspentTransactionOutput,
  TransactionHash,
  isPublicKeyHashLength,
  computeSha256,
  computeHash160,
  isP2WPKHScript,
} from "./bitcoin"
import { BitcoinNetwork, toBitcoinJsLibNetwork } from "./bitcoin-network"
import { Bridge, Event, Identifier } from "./chain"
import { Hex } from "./hex"
import { ECPairFactory } from "ecpair"
import * as tinysecp from "tiny-secp256k1"

// TODO: Replace all properties that are expected to be un-prefixed hexadecimal
// strings with a Hex type.

/**
 * Represents a deposit.
 */
export interface Deposit {
  /**
   * Depositor's chain identifier.
   */
  depositor: Identifier

  /**
   * Deposit amount in satoshis.
   */
  amount: BigNumber

  /**
   * An 8-byte blinding factor as an un-prefixed hex string. Must be unique
   * for the given depositor, wallet public key and refund public key.
   */
  blindingFactor: string

  /**
   * Public key hash of the wallet that is meant to receive the deposit. Must
   * be an unprefixed hex string (without 0x prefix).
   *
   * You can use `computeHash160` function to get the hash from a plain text public key.
   */
  walletPublicKeyHash: string

  /**
   * Public key hash that is meant to be used during deposit refund after the
   * locktime passes. Must be an unprefixed hex string (without 0x prefix).
   *
   * You can use `computeHash160` function to get the hash from a plain text public key.
   */
  refundPublicKeyHash: string

  /**
   * A 4-byte little-endian refund locktime as an un-prefixed hex string.
   */
  refundLocktime: string

  /**
   * Optional identifier of the vault the deposit should be routed in.
   */
  vault?: Identifier
}

/**
 * Helper type that groups deposit's fields required to assemble a deposit
 * script.
 */
export type DepositScriptParameters = Pick<
  Deposit,
  | "depositor"
  | "blindingFactor"
  | "refundLocktime"
  | "walletPublicKeyHash"
  | "refundPublicKeyHash"
> & {}

/**
 * Represents a deposit revealed to the on-chain bridge. This type emphasizes
 * the on-chain state of the revealed deposit and omits the deposit script
 * parameters as they are not relevant in this context.
 */
export type RevealedDeposit = Pick<
  Deposit,
  "depositor" | "amount" | "vault"
> & {
  /**
   * UNIX timestamp the deposit was revealed at.
   */
  revealedAt: number
  /**
   * UNIX timestamp the request was swept at. If not swept yet, this parameter
   * should have zero as value.
   */
  sweptAt: number
  /**
   * Value of the treasury fee calculated for this revealed deposit.
   * Denominated in satoshi.
   */
  treasuryFee: BigNumber
}

/**
 * Represents an event emitted on deposit reveal to the on-chain bridge.
 */
export type DepositRevealedEvent = Deposit & {
  fundingTxHash: TransactionHash
  fundingOutputIndex: number
} & Event

/**
 * Submits a deposit by creating and broadcasting a Bitcoin P2(W)SH
 * deposit transaction.
 * @dev UTXOs are selected for transaction funding based on their types. UTXOs
 *      with unsupported types are skipped. The selection process stops once
 *      the sum of the chosen UTXOs meets the required funding amount.
 * @param deposit - Details of the deposit.
 * @param depositorPrivateKey - Bitcoin private key of the depositor.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param witness - If true, a witness (P2WSH) transaction will be created.
 *        Otherwise, a legacy P2SH transaction will be made.
 * @param inputUtxos - UTXOs to be used for funding the deposit transaction. So
 *        far only P2WPKH UTXO inputs are supported.
 * @param fee - the value that should be subtracted from the sum of the UTXOs
 *        values and used as the transaction fee.
 * @returns The outcome consisting of:
 *          - the deposit transaction hash,
 *          - the deposit UTXO produced by this transaction.
 *  @throws {Error} When the sum of the selected UTXOs is insufficient to cover
 *        the deposit amount and transaction fee.
 */
export async function submitDepositTransaction(
  deposit: Deposit,
  depositorPrivateKey: string,
  bitcoinClient: BitcoinClient,
  witness: boolean,
  inputUtxos: UnspentTransactionOutput[],
  fee: BigNumber
): Promise<{
  transactionHash: TransactionHash
  depositUtxo: UnspentTransactionOutput
}> {
  const utxosWithRaw: (UnspentTransactionOutput & RawTransaction)[] = []
  for (const utxo of inputUtxos) {
    const utxoRawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    utxosWithRaw.push({
      ...utxo,
      transactionHex: utxoRawTransaction.transactionHex,
    })
  }

  const bitcoinNetwork = await bitcoinClient.getNetwork()

  const { transactionHash, depositUtxo, rawTransaction } =
    await assembleDepositTransaction(
      bitcoinNetwork,
      deposit,
      depositorPrivateKey,
      witness,
      utxosWithRaw,
      fee
    )

  await bitcoinClient.broadcast(rawTransaction)

  return {
    transactionHash,
    depositUtxo,
  }
}

/**
 * Assembles a Bitcoin P2(W)SH deposit transaction.
 * @dev UTXOs are selected for transaction funding based on their types. UTXOs
 *      with unsupported types are skipped. The selection process stops once
 *      the sum of the chosen UTXOs meets the required funding amount.
 * @param bitcoinNetwork - The target Bitcoin network (mainnet or testnet).
 * @param deposit - Details of the deposit.
 * @param depositorPrivateKey - Bitcoin private key of the depositor.
 * @param witness - If true, a witness (P2WSH) transaction will be created.
 *        Otherwise, a legacy P2SH transaction will be made.
 * @param utxos - UTXOs that should be used as transaction inputs.
 * @param fee - Transaction fee to be subtracted from the sum of the UTXOs'
 *        values.
 * @returns The outcome consisting of:
 *          - the deposit transaction hash,
 *          - the deposit UTXO produced by this transaction.
 *          - the deposit transaction in the raw format
 * @throws {Error} When the sum of the selected UTXOs is insufficient to cover
 *        the deposit amount and transaction fee.
 */
export async function assembleDepositTransaction(
  bitcoinNetwork: BitcoinNetwork,
  deposit: Deposit,
  depositorPrivateKey: string,
  witness: boolean,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  fee: BigNumber
): Promise<{
  transactionHash: TransactionHash
  depositUtxo: UnspentTransactionOutput
  rawTransaction: RawTransaction
}> {
  const network = toBitcoinJsLibNetwork(bitcoinNetwork)
  // eslint-disable-next-line new-cap
  const depositorKeyPair = ECPairFactory(tinysecp).fromWIF(
    depositorPrivateKey,
    network
  )

  const psbt = new Psbt({ network })
  psbt.setVersion(1)

  const totalExpenses = deposit.amount.add(fee)
  let totalInputValue = BigNumber.from(0)

  for (const utxo of utxos) {
    const previousOutput = Transaction.fromHex(utxo.transactionHex).outs[
      utxo.outputIndex
    ]
    const previousOutputValue = previousOutput.value
    const previousOutputScript = previousOutput.script

    // TODO: Add support for other utxo types along with unit tests for the
    //       given type.
    if (isP2WPKHScript(previousOutputScript)) {
      psbt.addInput({
        hash: utxo.transactionHash.reverse().toBuffer(),
        index: utxo.outputIndex,
        witnessUtxo: {
          script: previousOutputScript,
          value: previousOutputValue,
        },
      })

      totalInputValue = totalInputValue.add(utxo.value)
      if (totalInputValue.gte(totalExpenses)) {
        break
      }
    }
    // Skip UTXO if the type is unsupported.
  }

  // Sum of the selected UTXOs must be equal to or greater than the deposit
  // amount plus fee.
  if (totalInputValue.lt(totalExpenses)) {
    throw new Error("Not enough funds in selected UTXOs to fund transaction")
  }

  // Add deposit output.
  psbt.addOutput({
    address: await calculateDepositAddress(deposit, bitcoinNetwork, witness),
    value: deposit.amount.toNumber(),
  })

  // Add change output if needed.
  const changeValue = totalInputValue.sub(totalExpenses)
  if (changeValue.gt(0)) {
    const depositorAddress = createAddressFromPublicKey(
      Hex.from(depositorKeyPair.publicKey),
      bitcoinNetwork
    )
    psbt.addOutput({
      address: depositorAddress,
      value: changeValue.toNumber(),
    })
  }

  psbt.signAllInputs(depositorKeyPair)
  psbt.finalizeAllInputs()

  const transaction = psbt.extractTransaction()
  const transactionHash = TransactionHash.from(transaction.getId())

  return {
    transactionHash,
    depositUtxo: {
      transactionHash,
      outputIndex: 0, // The deposit is always the first output.
      value: deposit.amount,
    },
    rawTransaction: {
      transactionHex: transaction.toHex(),
    },
  }
}

/**
 * Assembles a Bitcoin locking script for P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @returns Script as an un-prefixed hex string.
 */
export async function assembleDepositScript(
  deposit: DepositScriptParameters
): Promise<string> {
  validateDepositScriptParameters(deposit)

  const chunks: Stack = []

  // All HEXes pushed to the script must be un-prefixed
  chunks.push(Buffer.from(deposit.depositor.identifierHex, "hex"))
  chunks.push(opcodes.OP_DROP)
  chunks.push(Buffer.from(deposit.blindingFactor, "hex"))
  chunks.push(opcodes.OP_DROP)
  chunks.push(opcodes.OP_DUP)
  chunks.push(opcodes.OP_HASH160)
  chunks.push(Buffer.from(deposit.walletPublicKeyHash, "hex"))
  chunks.push(opcodes.OP_EQUAL)
  chunks.push(opcodes.OP_IF)
  chunks.push(opcodes.OP_CHECKSIG)
  chunks.push(opcodes.OP_ELSE)
  chunks.push(opcodes.OP_DUP)
  chunks.push(opcodes.OP_HASH160)
  chunks.push(Buffer.from(deposit.refundPublicKeyHash, "hex"))
  chunks.push(opcodes.OP_EQUALVERIFY)
  chunks.push(Buffer.from(deposit.refundLocktime, "hex"))
  chunks.push(opcodes.OP_CHECKLOCKTIMEVERIFY)
  chunks.push(opcodes.OP_DROP)
  chunks.push(opcodes.OP_CHECKSIG)
  chunks.push(opcodes.OP_ENDIF)

  return script.compile(chunks).toString("hex")
}

// eslint-disable-next-line valid-jsdoc
/**
 * Validates the given deposit script parameters. Throws in case of a
 * validation error.
 * @param deposit - The validated deposit script parameters.
 * @dev This function does not validate the depositor's identifier as its
 *      validity is chain-specific. This parameter must be validated outside.
 */
export function validateDepositScriptParameters(
  deposit: DepositScriptParameters
) {
  if (deposit.blindingFactor.length != 16) {
    throw new Error("Blinding factor must be an 8-byte number")
  }

  if (!isPublicKeyHashLength(deposit.walletPublicKeyHash)) {
    throw new Error("Invalid wallet public key hash")
  }

  if (!isPublicKeyHashLength(deposit.refundPublicKeyHash)) {
    throw new Error("Invalid refund public key hash")
  }

  if (deposit.refundLocktime.length != 8) {
    throw new Error("Refund locktime must be a 4-byte number")
  }
}

/**
 * Calculates a refund locktime parameter for the given deposit creation timestamp.
 * Throws if the resulting locktime is not a 4-byte number.
 * @param depositCreatedAt - Unix timestamp in seconds determining the moment
 *        of deposit creation.
 * @param depositRefundLocktimeDuration - Deposit refund locktime duration in seconds.
 * @returns A 4-byte little-endian deposit refund locktime as an un-prefixed
 *          hex string.
 */
export function calculateDepositRefundLocktime(
  depositCreatedAt: number,
  depositRefundLocktimeDuration: number
): string {
  // Locktime is a Unix timestamp in seconds, computed as deposit creation
  // timestamp plus locktime duration.
  const locktime = BigNumber.from(
    depositCreatedAt + depositRefundLocktimeDuration
  )

  const locktimeHex: Hex = Hex.from(locktime.toHexString())

  if (locktimeHex.toString().length != 8) {
    throw new Error("Refund locktime must be a 4 bytes number")
  }

  // Bitcoin locktime is interpreted as little-endian integer so we must
  // adhere to that convention by converting the locktime accordingly.
  return locktimeHex.reverse().toString()
}

/**
 * Calculates a Bitcoin locking script hash for P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @param witness - If true, a witness script hash will be created.
 *        Otherwise, a legacy script hash will be made.
 * @returns Buffer with script hash.
 */
export async function calculateDepositScriptHash(
  deposit: DepositScriptParameters,
  witness: boolean
): Promise<Buffer> {
  const script = await assembleDepositScript(deposit)
  // If witness script hash should be produced, SHA256 should be used.
  // Legacy script hash needs HASH160.
  if (witness) {
    return computeSha256(Hex.from(script)).toBuffer()
  }

  return Buffer.from(computeHash160(script), "hex")
}

/**
 * Calculates a Bitcoin target address for P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @param network - Network that the address should be created for.
 * @param witness - If true, a witness address will be created.
 *        Otherwise, a legacy address will be made.
 * @returns Address as string.
 */
export async function calculateDepositAddress(
  deposit: DepositScriptParameters,
  network: BitcoinNetwork,
  witness: boolean
): Promise<string> {
  const scriptHash = await calculateDepositScriptHash(deposit, witness)
  const bitcoinNetwork = toBitcoinJsLibNetwork(network)

  if (witness) {
    // OP_0 <hash-length> <hash>
    const p2wshOutput = Buffer.concat([
      Buffer.from([opcodes.OP_0, 0x20]),
      scriptHash,
    ])

    return payments.p2wsh({ output: p2wshOutput, network: bitcoinNetwork })
      .address!
  }

  // OP_HASH160 <hash-length> <hash> OP_EQUAL
  const p2shOutput = Buffer.concat([
    Buffer.from([opcodes.OP_HASH160, 0x14]),
    scriptHash,
    Buffer.from([opcodes.OP_EQUAL]),
  ])

  return payments.p2sh({ output: p2shOutput, network: bitcoinNetwork }).address!
}

/**
 * Reveals the given deposit to the on-chain Bridge contract.
 * @param utxo - Deposit UTXO of the revealed deposit
 * @param deposit - Data of the revealed deposit
 * @param bitcoinClient - Bitcoin client used to interact with the network
 * @param bridge - Handle to the Bridge on-chain contract
 * @param vault - vault
 * @returns Transaction hash of the reveal deposit transaction as string
 * @dev The caller must ensure that the given deposit data are valid and
 *      the given deposit UTXO actually originates from a deposit transaction
 *      that matches the given deposit data.
 */
export async function revealDeposit(
  utxo: UnspentTransactionOutput,
  deposit: DepositScriptParameters,
  bitcoinClient: BitcoinClient,
  bridge: Bridge,
  vault?: Identifier
): Promise<string> {
  const depositTx = decomposeRawTransaction(
    await bitcoinClient.getRawTransaction(utxo.transactionHash)
  )

  return await bridge.revealDeposit(depositTx, utxo.outputIndex, deposit, vault)
}

/**
 * Gets a revealed deposit from the bridge.
 * @param utxo Deposit UTXO of the revealed deposit
 * @param bridge Handle to the Bridge on-chain contract
 * @returns Revealed deposit data.
 */
export async function getRevealedDeposit(
  utxo: UnspentTransactionOutput,
  bridge: Bridge
): Promise<RevealedDeposit> {
  return bridge.deposits(utxo.transactionHash, utxo.outputIndex)
}

/**
 * Suggests a wallet that should be used as the deposit target at the given moment.
 * @param bridge Handle to the Bridge on-chain contract.
 * @returns Compressed (33 bytes long with 02 or 03 prefix) public key of
 *          the wallet.
 */
export async function suggestDepositWallet(
  bridge: Bridge
): Promise<string | undefined> {
  return bridge.activeWalletPublicKey()
}
