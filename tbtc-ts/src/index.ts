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

// TODO: Documentation
export interface TBTC {
  makeDeposit(
    depositData: DepositData,
    depositorPrivateKey: string,
    bitcoinClient: BitcoinClient
  ): Promise<void>

  createDepositTransaction(
    depositData: DepositData,
    utxos: (UnspentTransactionOutput & RawTransaction)[],
    depositorPrivateKey: string
  ): Promise<RawTransaction>

  createDepositScript(depositData: DepositData): Promise<string>

  createDepositScriptHash(depositData: DepositData): Promise<Buffer>

  createDepositAddress(
    depositData: DepositData,
    network: string
  ): Promise<string>

  getActiveWalletPublicKey(): Promise<string>

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
