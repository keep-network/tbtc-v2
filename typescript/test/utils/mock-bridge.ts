import { Bridge, WalletRegistry, GetEvents, Identifier } from "../../src/chain"
import {
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "../../src/bitcoin"
import { BigNumberish, BigNumber, utils, constants } from "ethers"
import { RedemptionRequest } from "../redemption"
import {
  Deposit,
  DepositRevealedEvent,
  RevealedDeposit,
} from "../../src/deposit"
import { computeHash160, TransactionHash } from "../../src/bitcoin"
import { depositSweepWithNoMainUtxoAndWitnessOutput } from "../data/deposit-sweep"
import { Address } from "../../src/ethereum"
import { Hex } from "../../src/hex"
import { NewWalletRegisteredEvent, Wallet } from "../../src/wallet"

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
  private _activeWalletPublicKey: string | undefined

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

  setActiveWalletPublicKey(activeWalletPublicKey: string) {
    this._activeWalletPublicKey = activeWalletPublicKey
  }

  getDepositRevealedEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<any>
  ): Promise<DepositRevealedEvent[]> {
    const deposit = depositSweepWithNoMainUtxoAndWitnessOutput.deposits[0]

    return new Promise<DepositRevealedEvent[]>((resolve, _) => {
      resolve([
        {
          blockNumber: 32142,
          blockHash: Hex.from(
            "0xe43552af34efab0828278b91e0f984e4b9769abf85beaed41eee4c25c822a619"
          ),
          transactionHash: Hex.from(
            "0xdc6c041baaf1cc5bebca5aab02d0488e885a3687541ef012d9beb53141f73419"
          ),
          fundingTxHash: deposit.utxo.transactionHash,
          fundingOutputIndex: deposit.utxo.outputIndex,
          depositor: deposit.data.depositor,
          amount: deposit.utxo.value,
          blindingFactor: deposit.data.blindingFactor,
          walletPublicKeyHash: deposit.data.walletPublicKeyHash,
          refundPublicKeyHash: deposit.data.refundPublicKeyHash,
          refundLocktime: deposit.data.refundLocktime,
          vault: new Address(constants.AddressZero),
        },
      ])
    })
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
  ): Promise<string> {
    this._revealDepositLog.push({ depositTx, depositOutputIndex, deposit })
    return new Promise<string>((resolve, _) => {
      // random transaction hash
      resolve(
        "2f952bdc206bf51bb745b967cb7166149becada878d3191ffe341155ebcd4883"
      )
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
              depositor: Address.from(constants.AddressZero),
              amount: BigNumber.from(0),
              vault: Address.from(constants.AddressZero),
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
    const prefixedReversedDepositTxHash = depositTxHash
      .reverse()
      .toPrefixedString()

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
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    return new Promise<RedemptionRequest>((resolve, _) => {
      resolve(
        this.redemptions(
          walletPublicKey,
          redeemerOutputScript,
          this._pendingRedemptions
        )
      )
    })
  }

  timedOutRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    return new Promise<RedemptionRequest>((resolve, _) => {
      resolve(
        this.redemptions(
          walletPublicKey,
          redeemerOutputScript,
          this._timedOutRedemptions
        )
      )
    })
  }

  private redemptions(
    walletPublicKey: string,
    redeemerOutputScript: string,
    redemptionsMap: Map<BigNumberish, RedemptionRequest>
  ): RedemptionRequest {
    const redemptionKey = MockBridge.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    // Return the redemption if it is found in the map.
    // Otherwise, return zeroed values simulating the behavior of a smart contract.
    return redemptionsMap.has(redemptionKey)
      ? (redemptionsMap.get(redemptionKey) as RedemptionRequest)
      : {
          redeemer: Address.from(constants.AddressZero),
          redeemerOutputScript: "",
          requestedAmount: BigNumber.from(0),
          treasuryFee: BigNumber.from(0),
          txMaxFee: BigNumber.from(0),
          requestedAt: 0,
        }
  }

  static buildRedemptionKey(
    walletPublicKeyHash: string,
    redeemerOutputScript: string
  ): string {
    const prefixedWalletPublicKeyHash = `0x${walletPublicKeyHash}`

    const rawOutputScript = Buffer.from(redeemerOutputScript, "hex")

    const prefixedOutputScript = `0x${Buffer.concat([
      Buffer.from([rawOutputScript.length]),
      rawOutputScript,
    ]).toString("hex")}`

    return utils.solidityKeccak256(
      ["bytes32", "bytes20"],
      [
        utils.solidityKeccak256(["bytes"], [prefixedOutputScript]),
        prefixedWalletPublicKeyHash,
      ]
    )
  }

  async activeWalletPublicKey(): Promise<string | undefined> {
    return this._activeWalletPublicKey
  }

  async getNewWalletRegisteredEvents(
    options?: GetEvents.Options,
    ...filterArgs: Array<unknown>
  ): Promise<NewWalletRegisteredEvent[]> {
    throw new Error("not implemented")
  }

  walletRegistry(): Promise<WalletRegistry> {
    throw new Error("not implemented")
  }

  wallets(walletPublicKeyHash: string): Promise<Wallet> {
    throw new Error("not implemented")
  }

  buildUTXOHash(utxo: UnspentTransactionOutput): Hex {
    return Hex.from(
      utils.solidityKeccak256(
        ["bytes32", "uint32", "uint64"],
        [
          utxo.transactionHash.reverse().toPrefixedString(),
          utxo.outputIndex,
          utxo.value,
        ]
      )
    )
  }
}
