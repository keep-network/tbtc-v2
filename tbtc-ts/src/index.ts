import {
  createDepositAddress,
  createDepositScript,
  createDepositScriptHash,
  createDepositTransaction,
  getActiveWalletPublicKey,
  DepositData,
  makeDeposit,
  revealDeposit,
} from "./deposit"
import { createSweepTransaction, sweepDeposits } from "./sweep"
import { constructSweepProof } from "./sweepProof"
import {
  Client as BitcoinClient,
  RawTransaction,
  UnspentTransactionOutput,
  SweepProof,
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
  getActiveWalletPublicKey(): Promise<string>

  // TODO: Implementation and documentation.
  revealDeposit(): Promise<void>

  /**
   * Creates a Bitcoin P2WPKH sweep transaction.
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
   *                   from the previous sweep transaction (optional).
   * @returns Bitcoin sweep transaction in raw format.
   */
  createSweepTransaction(
    fee: BigNumber,
    walletPrivateKey: string,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositData: DepositData[],
    mainUtxo?: UnspentTransactionOutput & RawTransaction
  ): Promise<RawTransaction>

  /**
   * Sweeps P2(W)SH UTXOs by combining all the provided UTXOs and broadcasting
   * a Bitcoin P2WPKH sweep transaction.
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
   *                   from the previous sweep transaction (optional).
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
   * Constructs a sweep transaction proof that proves the given transaction is
   * included in the Bitcoin blockchain and has the required number of
   * confirmations.
   * @param transactionHash - Hash of the sweep transaction.
   * @param confirmations - Required number of confirmations for the transaction.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @returns Sweep transaction proof that can be passed to on-chain proof
   *          verification functions
   */
  constructSweepProof(
    transactionHash: string,
    confirmations: number,
    bitcoinClient: BitcoinClient
  ): Promise<SweepProof>
}

const tbtc: TBTC = {
  makeDeposit,
  createDepositTransaction,
  createDepositScript,
  createDepositScriptHash,
  createDepositAddress,
  getActiveWalletPublicKey,
  revealDeposit,
  createSweepTransaction,
  sweepDeposits,
  constructSweepProof,
}

export default tbtc
