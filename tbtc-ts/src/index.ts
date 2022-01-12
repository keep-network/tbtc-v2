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
import {
  Client as BitcoinClient,
  RawTransaction,
  UnspentTransactionOutput,
} from "./bitcoin"

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
}

const tbtc: TBTC = {
  makeDeposit,
  createDepositTransaction,
  createDepositScript,
  createDepositScriptHash,
  createDepositAddress,
  getActiveWalletPublicKey,
  revealDeposit,
}

export default tbtc
