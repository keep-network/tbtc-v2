import { Bridge } from "../../src/chain"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"
import { BigNumberish, BigNumber, utils, constants } from "ethers"
import { RedemptionRequest } from "../redemption"
import { Deposit } from "../../src/deposit"

interface DepositSweepProofLogEntry {
  sweepTx: DecomposedRawTransaction
  sweepProof: Proof
  mainUtxo: UnspentTransactionOutput
}

interface RevealDepositLogEntry {
  depositTx: DecomposedRawTransaction
  depositOutputIndex: number
  deposit: Deposit
}

/**
 * Mock Bridge used for test purposes.
 */
export class MockBridge implements Bridge {
  private _difficultyFactor = 6
  private _pendingRedemptions = new Map<BigNumberish, RedemptionRequest>()
  private _depositSweepProofLog: DepositSweepProofLogEntry[] = []
  private _revealDepositLogEntry: RevealDepositLogEntry[] = []

  set requestRedemptions(value: Map<BigNumberish, RedemptionRequest>) {
    this._pendingRedemptions = value
  }

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
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: Deposit
  ): Promise<void> {
    this._revealDepositLogEntry.push({ depositTx, depositOutputIndex, deposit })
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
      const prefixedWalletPubKeyHash = `0x${walletPubKeyHash}`

      const rawOutputScript = Buffer.from(redeemerOutputScript, "hex")

      const prefixedOutputScript = `0x${Buffer.concat([
        Buffer.from([rawOutputScript.length]),
        rawOutputScript,
      ]).toString("hex")}`

      const redemptionKey = utils.solidityKeccak256(
        ["bytes20", "bytes"],
        [prefixedWalletPubKeyHash, prefixedOutputScript]
      )

      // Return the redemption if it is found in the map.
      // Otherwise, return zeroed values simulating the behavior of a smart contract.
      resolve(
        this._pendingRedemptions.has(redemptionKey)
          ? (this._pendingRedemptions.get(redemptionKey) as RedemptionRequest)
          : {
              redeemer: { identifierHex: constants.AddressZero },
              redeemerOutputScript: "",
              requestedAmount: BigNumber.from(0),
              treasuryFee: BigNumber.from(0),
              txMaxFee: BigNumber.from(0),
              requestedAt: 0,
            }
      )
    })
  }
}
