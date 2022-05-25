import { Bridge as ChainBridge, Identifier } from "./chain"
import { BigNumber, constants, Contract, Signer, utils } from "ethers"
import { abi as BridgeABI } from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import { Deposit } from "./deposit"
import { RedemptionRequest } from "./redemption"
import {
  computeHash160,
  DecomposedRawTransaction,
  Proof,
  UnspentTransactionOutput,
} from "./bitcoin"

/**
 * Represents a config set required to connect an Ethereum contract.
 */
export interface ContractConfig {
  /**
   * Address of the Ethereum contract as a 0x-prefixed hex string.
   */
  address: string
  /**
   * Signer that will sign all contract transactions.
   */
  signer: Signer
}

/**
 * Implementation of the Ethereum Bridge handle.
 * @see {ChainBridge} for reference.
 */
export class Bridge implements ChainBridge {
  private _bridge: Contract

  constructor(config: ContractConfig) {
    this._bridge = new Contract(
      config.address,
      `${JSON.stringify(BridgeABI)}`,
      config.signer
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#pendingRedemptions}
   */
  async pendingRedemptions(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`
    // Build the redemption key by using the 0x-prefixed wallet PKH and
    // prefixed output script.
    const redemptionKey = utils.solidityKeccak256(
      ["bytes20", "bytes"],
      [`0x${walletPubKeyHash}`, prefixedRawRedeemerOutputScript]
    )

    const request = await this._bridge.pendingRedemptions(redemptionKey)

    return Promise.resolve({
      redeemer: {
        identifierHex: request.redeemer.substring(2).toLowerCase(),
      },
      redeemerOutputScript: redeemerOutputScript,
      requestedAmount: BigNumber.from(request.requestedAmount),
      treasuryFee: BigNumber.from(request.treasuryFee),
      txMaxFee: BigNumber.from(request.txMaxFee),
      requestedAt: BigNumber.from(request.requestedAt).toNumber(),
    })
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#revealDeposit}
   */
  async revealDeposit(
    depositTx: DecomposedRawTransaction,
    depositOutputIndex: number,
    deposit: Deposit
  ): Promise<void> {
    const depositTxParam = {
      version: `0x${depositTx.version}`,
      inputVector: `0x${depositTx.inputs}`,
      outputVector: `0x${depositTx.outputs}`,
      locktime: `0x${depositTx.locktime}`,
    }

    const revealParam = {
      fundingOutputIndex: depositOutputIndex,
      depositor: `0x${deposit.depositor.identifierHex}`,
      blindingFactor: `0x${deposit.blindingFactor}`,
      walletPubKeyHash: `0x${computeHash160(deposit.walletPublicKey)}`,
      refundPubKeyHash: `0x${computeHash160(deposit.refundPublicKey)}`,
      refundLocktime: `0x${deposit.refundLocktime}`,
      vault: deposit.vault
        ? `0x${deposit.vault.identifierHex}`
        : constants.AddressZero,
    }

    await this._bridge.revealDeposit(depositTxParam, revealParam)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#submitDepositSweepProof}
   */
  async submitDepositSweepProof(
    sweepTx: DecomposedRawTransaction,
    sweepProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    vault?: Identifier
  ): Promise<void> {
    const sweepTxParam = {
      version: `0x${sweepTx.version}`,
      inputVector: `0x${sweepTx.inputs}`,
      outputVector: `0x${sweepTx.outputs}`,
      locktime: `0x${sweepTx.locktime}`,
    }

    const sweepProofParam = {
      merkleProof: `0x${sweepProof.merkleProof}`,
      txIndexInBlock: sweepProof.txIndexInBlock,
      bitcoinHeaders: `0x${sweepProof.bitcoinHeaders}`,
    }

    const mainUtxoParam = {
      txHash: `0x${mainUtxo.transactionHash}`,
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const vaultParam = vault
      ? `0x${vault.identifierHex}`
      : constants.AddressZero

    await this._bridge.submitDepositSweepProof(
      sweepTxParam,
      sweepProofParam,
      mainUtxoParam,
      vaultParam
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#txProofDifficultyFactor}
   */
  async txProofDifficultyFactor(): Promise<number> {
    const txProofDifficultyFactor: BigNumber =
      await this._bridge.txProofDifficultyFactor()
    return txProofDifficultyFactor.toNumber()
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#requestRedemption}
   */
  async requestRedemption(
    walletPublicKey: string,
    mainUtxo: UnspentTransactionOutput,
    redeemerOutputScript: string,
    amount: BigNumber
  ): Promise<void> {
    const walletPublicKeyHash = `0x${computeHash160(walletPublicKey)}`

    const mainUtxoParam = {
      txHash: `0x${mainUtxo.transactionHash}`,
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`

    await this._bridge.requestRedemption(
      walletPublicKeyHash,
      mainUtxoParam,
      prefixedRawRedeemerOutputScript,
      amount
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#submitRedemptionProof}
   */
  async submitRedemptionProof(
    redemptionTx: DecomposedRawTransaction,
    redemptionProof: Proof,
    mainUtxo: UnspentTransactionOutput,
    walletPublicKey: string
  ): Promise<void> {
    const redemptionTxParam = {
      version: `0x${redemptionTx.version}`,
      inputVector: `0x${redemptionTx.inputs}`,
      outputVector: `0x${redemptionTx.outputs}`,
      locktime: `0x${redemptionTx.locktime}`,
    }

    const redemptionProofParam = {
      merkleProof: `0x${redemptionProof.merkleProof}`,
      txIndexInBlock: redemptionProof.txIndexInBlock,
      bitcoinHeaders: `0x${redemptionProof.bitcoinHeaders}`,
    }

    const mainUtxoParam = {
      txHash: `0x${mainUtxo.transactionHash}`,
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const walletPublicKeyHash = `0x${computeHash160(walletPublicKey)}`

    await this._bridge.submitRedemptionProof(
      redemptionTxParam,
      redemptionProofParam,
      mainUtxoParam,
      walletPublicKeyHash
    )
  }
}
