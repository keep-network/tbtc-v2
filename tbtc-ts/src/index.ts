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
   * Makes a deposit by creating and broadcasting a Bitcoin P2SH
   * deposit transaction.
   * @param depositData - Details of the deposit.
   * @param depositorPrivateKey - Bitcoin private key of the depositor.
   * @param bitcoinClient - Bitcoin client used to interact with the network.
   * @returns Empty promise.
   */
  makeDeposit(
    depositData: DepositData,
    depositorPrivateKey: string,
    bitcoinClient: BitcoinClient
  ): Promise<void>

  /**
   * Creates a Bitcoin P2SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @param utxos - UTXOs that should be used as transaction inputs.
   * @param depositorPrivateKey - Bitcoin private key of the depositor.
   * @returns Bitcoin P2SH deposit transaction in raw format.
   */
  createDepositTransaction(
    depositData: DepositData,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositorPrivateKey: string
  ): Promise<RawTransaction>

  /**
   * Creates a Bitcoin locking script for P2SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @returns Script as an un-prefixed hex string.
   */
  createDepositScript(depositData: DepositData): Promise<string>

  /**
   * Creates a Bitcoin locking script hash for P2SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @returns Buffer with script hash.
   */
  createDepositScriptHash(depositData: DepositData): Promise<Buffer>

  /**
   * Creates a Bitcoin target address for P2SH deposit transaction.
   * @param depositData - Details of the deposit.
   * @param network - Network that the address should be created for.
   *        For example, `main` or `testnet`.
   * @returns Address as string.
   */
  createDepositAddress(
    depositData: DepositData,
    network: string
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
