import { Bridge } from "../../src/bridge"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"

interface BridgeLog {
  sweepTx: DecomposedRawTransaction
  sweepProof: Proof
  mainUtxo: UnspentTransactionOutput
}

/**
 * Mock Bridge used for test purposes.
 */
export class MockBridge implements Bridge {
  private _difficultyFactor = 6
  private _depositSweepProofLog: BridgeLog[] = []

  get depositSweepProofLog(): BridgeLog[] {
    return this._depositSweepProofLog
  }

  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput
  ): Promise<void> {
    this._depositSweepProofLog.push({ sweepTx, sweepProof, mainUtxo })
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }

  txProofDifficultyFactor(): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._difficultyFactor)
    })
  }
}
