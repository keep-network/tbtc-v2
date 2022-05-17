import {
  createDepositAddress,
  createDepositScript,
  computeDepositRefundLocktime,
  createDepositScriptHash,
  createDepositTransaction,
  Deposit,
  makeDeposit,
  revealDeposit,
} from "./deposit"
import {
  createDepositSweepTransaction,
  sweepDeposits,
  proveDepositSweep,
} from "./deposit-sweep"
import { Bridge } from "./chain"
import {
  Client as BitcoinClient,
  RawTransaction,
  UnspentTransactionOutput,
} from "./bitcoin"
import { BigNumber } from "ethers"

/**
 * TBTC interface.
 */
export interface TBTC {
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
  makeDeposit(
    deposit: Deposit,
    depositorPrivateKey: string,
    bitcoinClient: BitcoinClient,
    witness: boolean
  ): Promise<void>

  /**
   * Creates a Bitcoin P2(W)SH deposit transaction.
   * @param deposit - Details of the deposit.
   * @param utxos - UTXOs that should be used as transaction inputs.
   * @param depositorPrivateKey - Bitcoin private key of the depositor.
   * @param witness - If true, a witness (P2WSH) transaction will be created.
   *        Otherwise, a legacy P2SH transaction will be made.
   * @returns Bitcoin P2(W)SH deposit transaction in raw format.
   */
  createDepositTransaction(
    deposit: Deposit,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositorPrivateKey: string,
    witness: boolean
  ): Promise<RawTransaction>

  /**
   * Creates a Bitcoin locking script for P2(W)SH deposit transaction.
   * @param deposit - Details of the deposit.
   * @returns Script as an un-prefixed hex string.
   */
  createDepositScript(deposit: Deposit): Promise<string>

  /**
   * Computes a refund locktime parameter for the given deposit creation timestamp.
   * @param depositCreatedAt - Unix timestamp in seconds determining the moment
   *                           of deposit creation.
   * @returns A 4-byte little-endian deposit refund locktime as an un-prefixed
   *          hex string.
   */
  computeDepositRefundLocktime(depositCreatedAt: number): string

  /**
   * Creates a Bitcoin locking script hash for P2(W)SH deposit transaction.
   * @param deposit - Details of the deposit.
   * @param witness - If true, a witness script hash will be created.
   *        Otherwise, a legacy script hash will be made.
   * @returns Buffer with script hash.
   */
  createDepositScriptHash(deposit: Deposit, witness: boolean): Promise<Buffer>

  /**
   * Creates a Bitcoin target address for P2(W)SH deposit transaction.
   * @param deposit - Details of the deposit.
   * @param network - Network that the address should be created for.
   *        For example, `main` or `testnet`.
   * @param witness - If true, a witness address will be created.
   *        Otherwise, a legacy address will be made.
   * @returns Address as string.
   */
  createDepositAddress(
    deposit: Deposit,
    network: string,
    witness: boolean
  ): Promise<string>

  // TODO: Implementation and documentation.
  revealDeposit(): Promise<void>

  /**
   * Sweeps deposits P2(W)SH UTXOs by combining all the provided UTXOs and
   * broadcasting a Bitcoin P2WPKH deposit sweep transaction.
   * @dev The caller is responsible for ensuring the provided UTXOs are correctly
   *      formed, can be spent by the wallet and their combined value is greater
   *      then the fee. Note that broadcasting transaction may fail silently (e.g.
   *      when the provided UTXOs are not spendable) and no error will be returned.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @param fee - the value that should be subtracted from the sum of the UTXOs
   *              values and used as the transaction fee.
   * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
   * @param utxos - P2(W)SH UTXOs to be combined into one output.
   * @param deposits - Array of deposits. Each element corresponds to UTXO.
   *                   The number of UTXOs and deposit elements must equal.
   * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
   *                   from the previous wallet transaction (optional).
   * @returns Empty promise.
   */
  sweepDeposits(
    bitcoinClient: BitcoinClient,
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: UnspentTransactionOutput[],
    deposits: Deposit[],
    mainUtxo?: UnspentTransactionOutput
  ): Promise<void>

  /**
   * Creates a Bitcoin P2WPKH deposit sweep transaction.
   * @dev The caller is responsible for ensuring the provided UTXOs are correctly
   *      formed, can be spent by the wallet and their combined value is greater
   *      then the fee.
   * @param fee - the value that should be subtracted from the sum of the UTXOs
   *              values and used as the transaction fee.
   * @param walletPrivateKey - Bitcoin private key of the wallet in WIF format.
   * @param utxos - UTXOs from new deposit transactions. Must be P2(W)SH.
   * @param deposits - Array of deposits. Each element corresponds to UTXO.
   *                   The number of UTXOs and deposit elements must equal.
   * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
   *                   from the previous wallet transaction (optional).
   * @returns Bitcoin deposit sweep transaction in raw format.
   */
  createDepositSweepTransaction(
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    deposits: Deposit[],
    mainUtxo?: UnspentTransactionOutput & RawTransaction
  ): Promise<RawTransaction>

  /**
   * Prepares the proof of a deposit sweep transaction and submits it to the
   * Bridge on-chain contract.
   * @param transactionHash - Hash of the transaction being proven.
   * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
   * @param bridge - Interface to the Bridge on-chain contract.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @returns Empty promise.
   */
  proveDepositSweep(
    transactionHash: string,
    mainUtxo: UnspentTransactionOutput,
    bridge: Bridge,
    bitcoinClient: BitcoinClient
  ): Promise<void>
}

const tbtc: TBTC = {
  makeDeposit,
  createDepositTransaction,
  createDepositScript,
  computeDepositRefundLocktime,
  createDepositScriptHash,
  createDepositAddress,
  revealDeposit,
  sweepDeposits,
  createDepositSweepTransaction,
  proveDepositSweep,
}

export default tbtc
