import { Bridge } from "../../src/chain"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"
import { BigNumberish, BigNumber, utils, constants } from "ethers"
import { RedemptionRequest } from "../redemption"

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
  private _pendingRedemptions = new Map<BigNumberish, RedemptionRequest>()
  private _depositSweepProofLog: BridgeLog[] = []

  set requestRedemptions(value: Map<BigNumberish, RedemptionRequest>) {
    this._pendingRedemptions = value
  }

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

  pendingRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    return new Promise<RedemptionRequest>((resolve, _) => {
      const redemptionKey = utils.solidityKeccak256(
        ["bytes20", "bytes"],
        [walletPubKeyHash, redeemerOutputScript]
      )

      // Return the redemption if it is found in the map.
      // Otherwise, return zeroed values simulating the behavior of a smart contract.
      resolve(
        this._pendingRedemptions.has(redemptionKey)
          ? (this._pendingRedemptions.get(redemptionKey) as RedemptionRequest)
          : {
              redeemerAddress: constants.AddressZero,
              requestedAmount: BigNumber.from(0),
              treasuryFee: BigNumber.from(0),
              txFee: BigNumber.from(0),
              requestedAt: 0,
            }
      )
    })
  }
}
