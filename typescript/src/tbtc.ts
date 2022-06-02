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
  requestRedemption,
  createRedemptionTransaction,
  makeRedemptions,
  proveRedemption,
  RedemptionRequest,
} from "./redemption"
import {
  createDepositSweepTransaction,
  sweepDeposits,
  proveDepositSweep,
} from "./deposit-sweep"
import { Bridge } from "./chain"
import {
  Client as BitcoinClient,
  RawTransaction, TransactionHash,
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
   * @returns The deposit UTXO that will be created by the deposit transaction
   */
  makeDeposit(
    deposit: Deposit,
    depositorPrivateKey: string,
    bitcoinClient: BitcoinClient,
    witness: boolean
  ): Promise<UnspentTransactionOutput>

  /**
   * Creates a Bitcoin P2(W)SH deposit transaction.
   * @param deposit - Details of the deposit.
   * @param utxos - UTXOs that should be used as transaction inputs.
   * @param depositorPrivateKey - Bitcoin private key of the depositor.
   * @param witness - If true, a witness (P2WSH) transaction will be created.
   *        Otherwise, a legacy P2SH transaction will be made.
   * @returns Deposit UTXO with Bitcoin P2(W)SH deposit transaction data in raw format.
   */
  createDepositTransaction(
    deposit: Deposit,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositorPrivateKey: string,
    witness: boolean
  ): Promise<UnspentTransactionOutput & RawTransaction>

  /**
   * Creates a Bitcoin locking script for P2(W)SH deposit transaction.
   * @param deposit - Details of the deposit.
   * @returns Script as an un-prefixed hex string.
   */
  createDepositScript(deposit: Deposit): Promise<string>

  /**
   * Computes a refund locktime parameter for the given deposit creation timestamp.
   * Throws if the resulting locktime is not a 4-byte number.
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

  /**
   * Reveals the given deposit to the on-chain Bridge contract
   * @param utxo - Deposit UTXO of the revealed deposit
   * @param deposit - Data of the revealed deposit
   * @param bitcoinClient - Bitcoin client used to interact with the network
   * @param bridge - Handle to the Bridge on-chain contract
   * @returns Empty promise
   * @dev The caller must ensure that the given deposit data are valid and
   *      the given deposit UTXO actually originates from a deposit transaction
   *      that matches the given deposit data.
   */
  revealDeposit(
    utxo: UnspentTransactionOutput,
    deposit: Deposit,
    bitcoinClient: BitcoinClient,
    bridge: Bridge
  ): Promise<void>

  /**
   * Sweeps P2(W)SH UTXOs by combining all the provided UTXOs and broadcasting
   * a Bitcoin P2WPKH deposit sweep transaction.
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
   * @returns The UTXO that will be created by the sweep transaction.
   */
  sweepDeposits(
    bitcoinClient: BitcoinClient,
    fee: BigNumber,
    walletPrivateKey: string,
    witness: boolean,
    utxos: UnspentTransactionOutput[],
    deposits: Deposit[],
    mainUtxo?: UnspentTransactionOutput
  ): Promise<UnspentTransactionOutput>

  /**
   * Creates a Bitcoin P2WPKH deposit sweep transaction.
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
   * @returns Resulting UTXO with Bitcoin sweep transaction data in raw format.
   */
  createDepositSweepTransaction(
    fee: BigNumber,
    walletPrivateKey: string,
    witness: boolean,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    deposits: Deposit[],
    mainUtxo?: UnspentTransactionOutput & RawTransaction
  ): Promise<UnspentTransactionOutput & RawTransaction>

  /**
   * Prepares the proof of a deposit sweep transaction and submits it to the
   * Bridge on-chain contract.
   * @param transactionHash - Hash of the transaction being proven.
   * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
   * @param bridge - Handle to the Bridge on-chain contract.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @returns Empty promise.
   */
  proveDepositSweep(
    transactionHash: TransactionHash,
    mainUtxo: UnspentTransactionOutput,
    bridge: Bridge,
    bitcoinClient: BitcoinClient
  ): Promise<void>

  /**
   * Requests a redemption from the on-chain Bridge contract.
   * @param walletPublicKey - The Bitcoin public key of the wallet. Must be in the
   *        compressed form (33 bytes long with 02 or 03 prefix).
   * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO
   *        held by the on-chain Bridge contract.
   * @param redeemerOutputScript - The output script that the redeemed funds will
   *        be locked to. Must be un-prefixed and not prepended with length.
   * @param amount - The amount to be redeemed in satoshis.
   * @param bridge - Handle to the Bridge on-chain contract.
   * @returns Empty promise.
   */
  requestRedemption(
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string,
    amount: BigNumber,
    bridge: Bridge
  ): Promise<void>

  /**
   * Handles pending redemption requests by creating a redemption transaction
   * transferring Bitcoins from the wallet's main UTXO to the provided redeemer
   * output scripts and broadcasting it. The change UTXO resulting from the
   * transaction becomes the new main UTXO of the wallet.
   * @dev It is up to the caller to ensure the wallet key and each of the redeemer
   *      output scripts represent a valid pending redemption request in the Bridge.
   *      If this is not the case, an exception will be thrown.
   * @param bitcoinClient - The Bitcoin client used to interact with the network
   * @param bridge - The handle to the Bridge on-chain contract
   * @param walletPrivateKey - The private kay of the wallet in the WIF format
   * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO
   *        held by the on-chain Bridge contract
   * @param redeemerOutputScripts - The list of output scripts that the redeemed
   *        funds will be locked to. The output scripts must be un-prefixed and
   *        not prepended with length
   * @param witness - The parameter used to decide about the type of the change
   *        output. P2WPKH if `true`, P2PKH if `false`
   * @returns Empty promise.
   */
  makeRedemptions(
    bitcoinClient: BitcoinClient,
    bridge: Bridge,
    walletPrivateKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScripts: string[],
    witness: boolean
  ): Promise<void>

  /**
   * Creates a Bitcoin redemption transaction.
   * The transaction will have a single input (main UTXO of the wallet making
   * the redemption), an output for each redemption request provided, and a change
   * output if the redemption requests do not consume the entire amount of the
   * single input.
   * @dev The caller is responsible for ensuring the redemption request list is
   *      correctly formed:
   *        - there is at least one redemption
   *        - the `requestedAmount` in each redemption request is greater than
   *          the sum of its `txFee` and `treasuryFee`
   * @param walletPrivateKey - The private key of the wallet in the WIF format
   * @param mainUtxo - The main UTXO of the wallet. Must match the main UTXO held
   *        by the on-chain Bridge contract
   * @param redemptionRequests - The list of redemption requests
   * @param witness - The parameter used to decide the type of the change output.
   *        P2WPKH if `true`, P2PKH if `false`
   * @returns Bitcoin redemption transaction in the raw format.
   */
  createRedemptionTransaction(
    walletPrivateKey: string,
    mainUtxo: UnspentTransactionOutput & RawTransaction,
    redemptionRequests: RedemptionRequest[],
    witness: boolean
  ): Promise<RawTransaction>

  /**
   * Prepares the proof of a redemption transaction and submits it to the
   * Bridge on-chain contract.
   * @param transactionHash - Hash of the transaction being proven.
   * @param mainUtxo - Recent main UTXO of the wallet as currently known on-chain.
   * @param walletPublicKey - Bitcoin public key of the wallet. Must be in the
   *        compressed form (33 bytes long with 02 or 03 prefix).
   * @param bridge - Handle to the Bridge on-chain contract.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @returns Empty promise.
   */
  proveRedemption(
    transactionHash: TransactionHash,
    mainUtxo: UnspentTransactionOutput,
    walletPublicKey: string,
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
  requestRedemption,
  makeRedemptions,
  createRedemptionTransaction,
  proveRedemption,
}

export default tbtc
