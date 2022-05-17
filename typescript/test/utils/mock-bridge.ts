import { Bridge } from "../../src/chain"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"
import { Deposit } from "../../src/deposit"

interface DepositSweepProofLogEntry {
  sweepTx: DecomposedRawTransaction
  sweepProof: Proof
  mainUtxo: UnspentTransactionOutput
}

interface RevealDepositLogEntry {
  fundingTx: DecomposedRawTransaction
  fundingOutputIndex: number
  deposit: Deposit
}

/**
 * Mock Bridge used for test purposes.
 */
export class MockBridge implements Bridge {
  private _difficultyFactor = 6
  private _depositSweepProofLog: DepositSweepProofLogEntry[] = []
  private _revealDepositLogEntry: RevealDepositLogEntry[] = []

  get depositSweepProofLog(): DepositSweepProofLogEntry[] {
    return this._depositSweepProofLog
  }

  get revealDepositLogEntry(): RevealDepositLogEntry[] {
    return this._revealDepositLogEntry
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

  revealDeposit(
    fundingTx: DecomposedRawTransaction,
    fundingOutputIndex: number,
    deposit: Deposit
  ): Promise<void> {
    this._revealDepositLogEntry.push({ fundingTx, fundingOutputIndex, deposit })
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
