import { Bridge, Identifier } from "../../src/chain"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"
import { BigNumberish, BigNumber, utils, constants } from "ethers"
import { RedemptionRequest } from "../redemption"
import { Deposit, RevealedDeposit } from "../../src/deposit"
import { TransactionHash } from "../../dist/bitcoin"

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

interface RequestRedemptionLogEntry {
  walletPublicKey: string
  mainUtxo: UnspentTransactionOutput
  redeemerOutputScript: string
  amount: BigNumber
}

interface RedemptionProofLogEntry {
  redemptionTx: DecomposedRawTransaction
  redemptionProof: Proof
  mainUtxo: UnspentTransactionOutput
  walletPublicKey: string
}

/**
 * Mock Bridge used for test purposes.
 */
export class MockBridge implements Bridge {
  private _difficultyFactor = 6
  private _pendingRedemptions = new Map<BigNumberish, RedemptionRequest>()
  private _timedOutRedemptions = new Map<BigNumberish, RedemptionRequest>()
  private _depositSweepProofLog: DepositSweepProofLogEntry[] = []
  private _revealDepositLog: RevealDepositLogEntry[] = []
  private _requestRedemptionLog: RequestRedemptionLogEntry[] = []
  private _redemptionProofLog: RedemptionProofLogEntry[] = []
  private _deposits = new Map<BigNumberish, RevealedDeposit>()

  setPendingRedemptions(value: Map<BigNumberish, RedemptionRequest>) {
    this._pendingRedemptions = value
  }

  setTimedOutRedemptions(value: Map<BigNumberish, RedemptionRequest>) {
    this._timedOutRedemptions = value
  }

  get depositSweepProofLog(): DepositSweepProofLogEntry[] {
    return this._depositSweepProofLog
  }

  get revealDepositLog(): RevealDepositLogEntry[] {
    return this._revealDepositLog
  }

  get requestRedemptionLog(): RequestRedemptionLogEntry[] {
    return this._requestRedemptionLog
  }

  get redemptionProofLog(): RedemptionProofLogEntry[] {
    return this._redemptionProofLog
  }

  setDeposits(value: Map<BigNumberish, RevealedDeposit>) {
    this._deposits = value
  }

  submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    vault?: Identifier
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
    this._revealDepositLog.push({ depositTx, depositOutputIndex, deposit })
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }

  deposits(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<RevealedDeposit> {
    return new Promise<RevealedDeposit>((resolve, _) => {
      const depositKey = MockBridge.buildDepositKey(
        depositTxHash,
        depositOutputIndex
      )

      resolve(
        this._deposits.has(depositKey)
          ? (this._deposits.get(depositKey) as RevealedDeposit)
          : {
              depositor: { identifierHex: constants.AddressZero },
              amount: BigNumber.from(0),
              vault: { identifierHex: constants.AddressZero },
              revealedAt: 0,
              sweptAt: 0,
              treasuryFee: BigNumber.from(0),
            }
      )
    })
  }

  static buildDepositKey(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): string {
    const prefixedReversedDepositTxHash = `0x${Buffer.from(depositTxHash, "hex")
      .reverse()
      .toString("hex")}`

    return utils.solidityKeccak256(
      ["bytes32", "uint32"],
      [prefixedReversedDepositTxHash, depositOutputIndex]
    )
  }

  submitRedemptionProof(
    redemptionTx: DecomposedRawTransaction,
    redemptionProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    walletPublicKey: string
  ): Promise<void> {
    this._redemptionProofLog.push({
      redemptionTx,
      redemptionProof,
      mainUtxo,
      walletPublicKey,
    })
    return new Promise<void>((resolve, _) => {
      resolve()
    })
  }

  requestRedemption(
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string,
    amount: BigNumber
  ) {
    this._requestRedemptionLog.push({
      walletPublicKey,
      mainUtxo,
      redeemerOutputScript,
      amount,
    })
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
      resolve(
        this.redemptions(
          walletPubKeyHash,
          redeemerOutputScript,
          this._pendingRedemptions
        )
      )
    })
  }

  timedOutRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    return new Promise<RedemptionRequest>((resolve, _) => {
      resolve(
        this.redemptions(
          walletPubKeyHash,
          redeemerOutputScript,
          this._timedOutRedemptions
        )
      )
    })
  }

  private redemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string,
    redemptionsMap: Map<BigNumberish, RedemptionRequest>
  ): RedemptionRequest {
    const redemptionKey = MockBridge.buildRedemptionKey(
      walletPubKeyHash,
      redeemerOutputScript
    )

    // Return the redemption if it is found in the map.
    // Otherwise, return zeroed values simulating the behavior of a smart contract.
    return redemptionsMap.has(redemptionKey)
      ? (redemptionsMap.get(redemptionKey) as RedemptionRequest)
      : {
          redeemer: { identifierHex: constants.AddressZero },
          redeemerOutputScript: "",
          requestedAmount: BigNumber.from(0),
          treasuryFee: BigNumber.from(0),
          txMaxFee: BigNumber.from(0),
          requestedAt: 0,
        }
  }

  static buildRedemptionKey(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): string {
    const prefixedWalletPubKeyHash = `0x${walletPubKeyHash}`

    const rawOutputScript = Buffer.from(redeemerOutputScript, "hex")

    const prefixedOutputScript = `0x${Buffer.concat([
      Buffer.from([rawOutputScript.length]),
      rawOutputScript,
    ]).toString("hex")}`

    return utils.solidityKeccak256(
      ["bytes32", "bytes20"],
      [
        utils.solidityKeccak256(["bytes"], [prefixedOutputScript]),
        prefixedWalletPubKeyHash,
      ]
    )
  }
}
