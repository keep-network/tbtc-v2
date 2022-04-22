import { Bridge, PendingRedemption } from "../../src/bridge"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"
import { BigNumberish, BigNumber, constants } from "ethers"

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
  private _sweepProofLog: BridgeLog[] = []
  private _pendingRedemptions = new Map<BigNumberish, PendingRedemption>()

  set pendingRedemptions(value: Map<BigNumberish, PendingRedemption>) {
    this._pendingRedemptions = value
  }

  get sweepProofLog(): BridgeLog[] {
    return this._sweepProofLog
  }

  submitSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput
  ): Promise<void> {
    this._sweepProofLog.push({ sweepTx, sweepProof, mainUtxo })
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }

  txProofDifficultyFactor(): Promise<number> {
    return new Promise<number>((resolve, _) => {
      resolve(this._difficultyFactor)
    })
  }

  getPendingRedemptions(
    redemptionKey: BigNumberish
  ): Promise<PendingRedemption> {
    return new Promise<PendingRedemption>((resolve, _) => {
      // Return the redemption if it is found in the map.
      // Otherwise, return zeroed values simulating the behavior of a smart contract.
      resolve(
        this._pendingRedemptions.has(redemptionKey)
          ? (this._pendingRedemptions.get(redemptionKey) as PendingRedemption)
          : {
              redeemer: constants.AddressZero,
              requestedAmount: BigNumber.from(0),
              treasuryFee: BigNumber.from(0),
              txMaxFee: BigNumber.from(0),
              requestedAt: 0,
            }
      )
    })
  }
}
