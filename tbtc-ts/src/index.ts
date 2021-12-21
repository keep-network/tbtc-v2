import {
  createDepositAddress,
  createDepositScript,
  createDepositTransaction,
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
    changeAddress: string
  ): Promise<RawTransaction>

  createDepositScript(depositData: DepositData): string

  createDepositAddress(depositData: DepositData, network: string): string

  revealDeposit(): Promise<void>
}

const tbtc: TBTC = {
  makeDeposit,
  createDepositTransaction,
  createDepositScript,
  createDepositAddress,
  revealDeposit,
}

export default tbtc
