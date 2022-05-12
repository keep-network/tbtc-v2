import {
  createDepositAddress,
  createDepositScript,
  createDepositScriptHash,
  createDepositTransaction,
  DepositData,
  makeDeposit,
  revealDeposit,
} from "./deposit"
import {
  createRedemptionTransaction,
  redeemDeposits,
  RedemptionRequest,
} from "./redemption"
import {
  createDepositSweepTransaction,
  sweepDeposits,
  proveDepositSweep,
} from "./deposit-sweep"
import { Bridge } from "./bridge"
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
   * @param depositData - Details of the deposit.
   * @param depositorPrivateKey - Bitcoin private key of the depositor.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @param witness - If true, a witness (P2WSH) transaction will be created.
   *        Otherwise, a legacy P2SH transaction will be made.
   * @returns Empty promise.
   */
  makeDeposit(
    depositData: DepositData,
    depositorPrivateKey: string,
    bitcoinClient: BitcoinClient,
    witness: boolean
  ): Promise<void>

  /**
   * Creates a Bitcoin P2(W)SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @param utxos - UTXOs that should be used as transaction inputs.
   * @param depositorPrivateKey - Bitcoin private key of the depositor.
   * @param witness - If true, a witness (P2WSH) transaction will be created.
   *        Otherwise, a legacy P2SH transaction will be made.
   * @returns Bitcoin P2(W)SH deposit transaction in raw format.
   */
  createDepositTransaction(
    depositData: DepositData,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositorPrivateKey: string,
    witness: boolean
  ): Promise<RawTransaction>

  /**
   * Creates a Bitcoin locking script for P2(W)SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @returns Script as an un-prefixed hex string.
   */
  createDepositScript(depositData: DepositData): Promise<string>

  /**
   * Creates a Bitcoin locking script hash for P2(W)SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @param witness - If true, a witness script hash will be created.
   *        Otherwise, a legacy script hash will be made.
   * @returns Buffer with script hash.
   */
  createDepositScriptHash(
    depositData: DepositData,
    witness: boolean
  ): Promise<Buffer>

  /**
   * Creates a Bitcoin target address for P2(W)SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @param network - Network that the address should be created for.
   *        For example, `main` or `testnet`.
   * @param witness - If true, a witness address will be created.
   *        Otherwise, a legacy address will be made.
   * @returns Address as string.
   */
  createDepositAddress(
    depositData: DepositData,
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
   * @param depositData - data on deposits. Each element corresponds to UTXO.
   *                      The number of UTXOs and deposit data elements must
   *                      equal.
   * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
   *                   from the previous wallet transaction (optional).
   * @returns Empty promise.
   */
  sweepDeposits(
    bitcoinClient: BitcoinClient,
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: UnspentTransactionOutput[],
    depositData: DepositData[],
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
   * @param depositData - data on deposits. Each element corresponds to UTXO.
   *                      The number of UTXOs and deposit data elements must equal.
   * @param mainUtxo - main UTXO of the wallet, which is a P2WKH UTXO resulting
   *                   from the previous wallet transaction (optional).
   * @returns Bitcoin deposit sweep transaction in raw format.
   */
  createDepositSweepTransaction(
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositData: DepositData[],
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

  /**
   * Redeems deposited tBTC by creating a redemption transaction transferring
   * Bitcoins from the wallet's main UTXO to the redeemer addresses and
   * broadcasting it. The change UTXO resulting from the transaction becomes
   * the new main UTXO of the wallet.
   * @dev It is up to the caller to ensure the wallet key and each of the redeemer
   *      addresses represent a valid pending redemption request in the Bridge.
   * @param bitcoinClient - The Bitcoin client used to interact with the network
   * @param bridge - The Interface used to interact with the Bridge on-chain contract
   * @param walletPrivateKey = The private kay of the wallet in the WIF format
   * @param mainUtxo - The main UTXO of the wallet. Must be P2(W)PKH
   * @param redeemerAddresses - The list of redeemer addresses.
   * @param witness - The parameter used to decide the type of the change output.
   *                  P2WPKH if `true`, P2PKH if `false`
   * @returns Empty promise.
   */
  redeemDeposits(
    bitcoinClient: BitcoinClient,
    bridge: Bridge,
    walletPrivateKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerAddresses: string[],
    witness: boolean
  ): Promise<void>

  /**
   * Creates a Bitcoin redemption transaction.
   * The transaction will have a single input (main UTXO) and an output for each
   * redemption request provided and a change output if the redemption requests
   * do not consume all the Bitcoins from the main UTXO.
   * @dev The caller is responsible for ensuring the redemption request list is
   *      correctly formed:
   *        - there is at least one redemption
   *        - the `requestedAmount` in each redemption request is greater than
   *          the sum of its `feeShare` and `treasuryFee`
   *        - the redeemer address in each redemption request is of a standard
   *          type (P2PKH, P2WPKH, P2SH, P2WSH).
   * @param walletPrivateKey  - The private key of the wallet in the WIF format
   * @param mainUtxo - The main UTXO of the wallet. Must be P2(W)PKH
   * @param redemptionRequests - The list of redemption requests
   * @param witness - The parameter used to decide the type of the change output.
   *                  P2WPKH if `true`, P2PKH if `false`
   * @returns Bitcoin redemption transaction in the raw format.
   */
  createRedemptionTransaction(
    walletPrivateKey: string,
    mainUtxo: UnspentTransactionOutput & RawTransaction,
    redemptionRequests: RedemptionRequest[],
    witness: boolean
  ): Promise<RawTransaction>
}

const tbtc: TBTC = {
  makeDeposit,
  createDepositTransaction,
  createDepositScript,
  createDepositScriptHash,
  createDepositAddress,
  revealDeposit,
  sweepDeposits,
  createDepositSweepTransaction,
  proveDepositSweep,
  redeemDeposits,
  createRedemptionTransaction,
}

export default tbtc
