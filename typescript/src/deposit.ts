// @ts-ignore
import bcoin from "bcoin"
// @ts-ignore
import hash160 from "bcrypto/lib/hash160"
// @ts-ignore
import { opcodes } from "bcoin/lib/script/common"
// @ts-ignore
import wif from "wif"
import { BigNumber } from "ethers"
import {
  Client as BitcoinClient,
  isCompressedPublicKey,
  RawTransaction,
  UnspentTransactionOutput,
} from "./bitcoin"
import { Identifier } from "./chain"

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
   * An 8 bytes blinding factor as an un-prefixed hex string. Must be unique
   * for the given depositor, wallet public key and refund public key.
   */
  blindingFactor: string

  /**
   * Compressed (33 bytes long with 02 or 03 prefix) Bitcoin public key of
   * the wallet that is meant to receive the deposit.
   */
  walletPublicKey: string

  /**
   * Compressed (33 bytes long with 02 or 03 prefix) Bitcoin public key that
   * is meant to be used during deposit refund after the locktime passes.
   */
  refundPublicKey: string

  /**
   * Unix timestamp in seconds determining the moment of deposit creation.
   */
  createdAt: number
}

/**
 * Makes a deposit by creating and broadcasting a Bitcoin P2(W)SH
 * deposit transaction.
 * @param deposit - Details of the deposit.
 * @param depositorPrivateKey - Bitcoin private key of the depositor.
 * @param bitcoinClient - Bitcoin client used to interact with the network.
 * @param witness - If true, a witness (P2WSH) transaction will be created.
 *        Otherwise, a legacy P2SH transaction will be made.
 * @returns Empty promise.
 */
export async function makeDeposit(
  deposit: Deposit,
  depositorPrivateKey: string,
  bitcoinClient: BitcoinClient,
  witness: boolean
): Promise<void> {
  const depositorKeyRing = createKeyRing(depositorPrivateKey)
  const depositorAddress = depositorKeyRing.getAddress("string")

  const utxos = await bitcoinClient.findAllUnspentTransactionOutputs(
    depositorAddress
  )

  const utxosWithRaw: (UnspentTransactionOutput & RawTransaction)[] = []
  for (const utxo of utxos) {
    const rawTransaction = await bitcoinClient.getRawTransaction(
      utxo.transactionHash
    )

    utxosWithRaw.push({
      ...utxo,
      transactionHex: rawTransaction.transactionHex,
    })
  }

  const transaction = await createDepositTransaction(
    deposit,
    utxosWithRaw,
    depositorPrivateKey,
    witness
  )

  await bitcoinClient.broadcast(transaction)
}

/**
 * Creates a Bitcoin P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @param utxos - UTXOs that should be used as transaction inputs.
 * @param depositorPrivateKey - Bitcoin private key of the depositor.
 * @param witness - If true, a witness (P2WSH) transaction will be created.
 *        Otherwise, a legacy P2SH transaction will be made.
 * @returns Bitcoin P2(W)SH deposit transaction in raw format.
 */
export async function createDepositTransaction(
  deposit: Deposit,
  utxos: (UnspentTransactionOutput & RawTransaction)[],
  depositorPrivateKey: string,
  witness: boolean
): Promise<RawTransaction> {
  const depositorKeyRing = createKeyRing(depositorPrivateKey)
  const depositorAddress = depositorKeyRing.getAddress("string")

  const inputCoins = utxos.map((utxo) =>
    bcoin.Coin.fromTX(
      bcoin.MTX.fromRaw(utxo.transactionHex, "hex"),
      utxo.outputIndex,
      -1
    )
  )

  const transaction = new bcoin.MTX()

  const scriptHash = await createDepositScriptHash(deposit, witness)

  transaction.addOutput({
    script: witness
      ? bcoin.Script.fromProgram(0, scriptHash)
      : bcoin.Script.fromScripthash(scriptHash),
    value: deposit.amount.toNumber(),
  })

  await transaction.fund(inputCoins, {
    rate: null, // set null explicitly to always use the default value
    changeAddress: depositorAddress,
    subtractFee: false, // do not subtract the fee from outputs
  })

  transaction.sign(depositorKeyRing)

  return {
    transactionHex: transaction.toRaw().toString("hex"),
  }
}

/**
 * Creates a Bitcoin locking script for P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @returns Script as an un-prefixed hex string.
 */
export async function createDepositScript(deposit: Deposit): Promise<string> {
  const depositor = deposit.depositor

  // Blinding factor should be an 8 bytes number.
  const blindingFactor = deposit.blindingFactor
  if (blindingFactor.length != 16) {
    throw new Error("Blinding factor must be an 8 bytes number")
  }

  const walletPublicKey = deposit.walletPublicKey
  if (!isCompressedPublicKey(walletPublicKey)) {
    throw new Error("Wallet public key must be compressed")
  }

  const refundPublicKey = deposit.refundPublicKey
  if (!isCompressedPublicKey(refundPublicKey)) {
    throw new Error("Refund public key must be compressed")
  }

  // Locktime is an Unix timestamp in seconds, computed as deposit
  // creation timestamp + 30 days.
  const locktime = BigNumber.from(deposit.createdAt + 2592000)

  // All HEXes pushed to the script must be un-prefixed.
  const script = new bcoin.Script()
  script.clear()
  script.pushData(Buffer.from(depositor.identifierHex, "hex"))
  script.pushOp(opcodes.OP_DROP)
  script.pushData(Buffer.from(blindingFactor, "hex"))
  script.pushOp(opcodes.OP_DROP)
  script.pushOp(opcodes.OP_DUP)
  script.pushOp(opcodes.OP_HASH160)
  script.pushData(hash160.digest(Buffer.from(walletPublicKey, "hex")))
  script.pushOp(opcodes.OP_EQUAL)
  script.pushOp(opcodes.OP_IF)
  script.pushOp(opcodes.OP_CHECKSIG)
  script.pushOp(opcodes.OP_ELSE)
  script.pushOp(opcodes.OP_DUP)
  script.pushOp(opcodes.OP_HASH160)
  script.pushData(hash160.digest(Buffer.from(refundPublicKey, "hex")))
  script.pushOp(opcodes.OP_EQUALVERIFY)
  script.pushData(
    // Bitcoin locktime is interpreted as little-endian integer so we must
    // adhere to that convention by converting the locktime accordingly.
    Buffer.from(locktime.toHexString().substring(2), "hex").reverse()
  )
  script.pushOp(opcodes.OP_CHECKLOCKTIMEVERIFY)
  script.pushOp(opcodes.OP_DROP)
  script.pushOp(opcodes.OP_CHECKSIG)
  script.pushOp(opcodes.OP_ENDIF)
  script.compile()

  // Return script as HEX string.
  return script.toRaw().toString("hex")
}

/**
 * Creates a Bitcoin locking script hash for P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @param witness - If true, a witness script hash will be created.
 *        Otherwise, a legacy script hash will be made.
 * @returns Buffer with script hash.
 */
export async function createDepositScriptHash(
  deposit: Deposit,
  witness: boolean
): Promise<Buffer> {
  const script = await createDepositScript(deposit)
  // Parse the script from HEX string.
  const parsedScript = bcoin.Script.fromRaw(Buffer.from(script, "hex"))
  // If witness script hash should be produced, SHA256 should be used.
  // Legacy script hash needs HASH160.
  return witness ? parsedScript.sha256() : parsedScript.hash160()
}

/**
 * Creates a Bitcoin target address for P2(W)SH deposit transaction.
 * @param deposit - Details of the deposit.
 * @param network - Network that the address should be created for.
 *        For example, `main` or `testnet`.
 * @param witness - If true, a witness address will be created.
 *        Otherwise, a legacy address will be made.
 * @returns Address as string.
 */
export async function createDepositAddress(
  deposit: Deposit,
  network: string,
  witness: boolean
): Promise<string> {
  const scriptHash = await createDepositScriptHash(deposit, witness)
  const address = witness
    ? bcoin.Address.fromWitnessScripthash(scriptHash)
    : bcoin.Address.fromScripthash(scriptHash)
  return address.toString(network)
}

/**
 * Creates a Bitcoin key ring based on given private key.
 * @param privateKey Private key that should be used to create the key ring.
 * @returns Bitcoin key ring.
 */
function createKeyRing(privateKey: string): bcoin.KeyRing {
  const decodedPrivateKey = wif.decode(privateKey)

  return new bcoin.KeyRing({
    witness: true,
    privateKey: decodedPrivateKey.privateKey,
    compressed: decodedPrivateKey.compressed,
  })
}

// TODO: Implementation and documentation.
export async function revealDeposit(): Promise<void> {}
