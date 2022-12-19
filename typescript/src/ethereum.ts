import { Bridge as ChainBridge, Identifier as ChainIdentifier } from "./chain"
import { BigNumber, constants, Contract, Signer, utils } from "ethers"
import {
  abi as BridgeABI,
  address as BridgeAddress,
} from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import {
  abi as WalletRegistryABI,
  address as WalletRegistryAddress,
} from "@keep-network/tbtc-v2/artifacts/WalletRegistry.json"
import { Deposit, RevealedDeposit } from "./deposit"
import { RedemptionRequest } from "./redemption"
import {
  compressPublicKey,
  computeHash160,
  DecomposedRawTransaction,
  Proof,
  TransactionHash,
  UnspentTransactionOutput,
} from "./bitcoin"

/**
 * Represents an Ethereum address.
 */
export class Address implements ChainIdentifier {
  readonly identifierHex: string

  constructor(address: string) {
    let validAddress: string

    try {
      validAddress = utils.getAddress(address)
    } catch (e) {
      throw new Error(`Invalid Ethereum address`)
    }

    this.identifierHex = validAddress.substring(2).toLowerCase()
  }
}

/**
 * Represents a config set required to connect an Ethereum contract.
 */
export interface ContractConfig {
  /**
   * Address of the Ethereum contract as a 0x-prefixed hex string.
   */
  address?: string
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
      config.address || utils.getAddress(BridgeAddress),
      `${JSON.stringify(BridgeABI)}`,
      config.signer
    )
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#pendingRedemptions}
   */
  async pendingRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    const redemptionKey = this.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    const request = await this._bridge.pendingRedemptions(redemptionKey)

    return this.parseRedemptionRequest(request, redeemerOutputScript)
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#timedOutRedemptions}
   */
  async timedOutRedemptions(
    walletPublicKey: string,
    redeemerOutputScript: string
  ): Promise<RedemptionRequest> {
    const redemptionKey = this.buildRedemptionKey(
      computeHash160(walletPublicKey),
      redeemerOutputScript
    )

    const request = await this._bridge.timedOutRedemptions(redemptionKey)

    return this.parseRedemptionRequest(request, redeemerOutputScript)
  }

  /**
   * Builds a redemption key required to refer a redemption request.
   * @param walletPubKeyHash The wallet public key hash that identifies the
   *        pending redemption (along with the redeemer output script). Must be
   *        unprefixed.
   * @param redeemerOutputScript The redeemer output script that identifies the
   *        pending redemption (along with the wallet public key hash). Must be
   *        un-prefixed and not prepended with length.
   * @returns The redemption key.
   */
  private buildRedemptionKey(
    walletPubKeyHash: string,
    redeemerOutputScript: string
  ): string {
    // Convert the output script to raw bytes buffer.
    const rawRedeemerOutputScript = Buffer.from(redeemerOutputScript, "hex")
    // Prefix the output script bytes buffer with 0x and its own length.
    const prefixedRawRedeemerOutputScript = `0x${Buffer.concat([
      Buffer.from([rawRedeemerOutputScript.length]),
      rawRedeemerOutputScript,
    ]).toString("hex")}`
    // Build the redemption key by using the 0x-prefixed wallet PKH and
    // prefixed output script.
    return utils.solidityKeccak256(
      ["bytes32", "bytes20"],
      [
        utils.solidityKeccak256(["bytes"], [prefixedRawRedeemerOutputScript]),
        `0x${walletPubKeyHash}`,
      ]
    )
  }

  /**
   * Parses a redemption request using data fetched from the on-chain contract.
   * @param request Data of the request.
   * @param redeemerOutputScript The redeemer output script that identifies the
   *        pending redemption (along with the wallet public key hash). Must be
   *        un-prefixed and not prepended with length.
   * @returns Parsed redemption request.
   */
  private parseRedemptionRequest(
    request: any,
    redeemerOutputScript: string
  ): RedemptionRequest {
    return {
      redeemer: new Address(request.redeemer),
      redeemerOutputScript: redeemerOutputScript,
      requestedAmount: BigNumber.from(request.requestedAmount),
      treasuryFee: BigNumber.from(request.treasuryFee),
      txMaxFee: BigNumber.from(request.txMaxFee),
      requestedAt: BigNumber.from(request.requestedAt).toNumber(),
    }
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
    vault?: ChainIdentifier
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
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: `0x${Buffer.from(mainUtxo.transactionHash, "hex")
        .reverse()
        .toString("hex")}`,
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
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: `0x${Buffer.from(mainUtxo.transactionHash, "hex")
        .reverse()
        .toString("hex")}`,
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
      // The Ethereum Bridge expects this hash to be in the Bitcoin internal
      // byte order.
      txHash: `0x${Buffer.from(mainUtxo.transactionHash, "hex")
        .reverse()
        .toString("hex")}`,
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

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#deposits}
   */
  async deposits(
    depositTxHash: TransactionHash,
    depositOutputIndex: number
  ): Promise<RevealedDeposit> {
    const depositKey = this.buildDepositKey(depositTxHash, depositOutputIndex)

    const deposit = await this._bridge.deposits(depositKey)

    return this.parseRevealedDeposit(deposit)
  }

  /**
   * Builds the deposit key required to refer a revealed deposit.
   * @param depositTxHash The revealed deposit transaction's hash.
   * @param depositOutputIndex Index of the deposit transaction output that
   *        funds the revealed deposit.
   * @returns Revealed deposit data.
   */
  private buildDepositKey(
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

  /**
   * Parses a revealed deposit using data fetched from the on-chain contract.
   * @param deposit Data of the revealed deposit.
   * @returns Parsed revealed deposit.
   */
  private parseRevealedDeposit(deposit: any): RevealedDeposit {
    return {
      depositor: new Address(deposit.depositor),
      amount: BigNumber.from(deposit.amount),
      vault:
        deposit.vault === constants.AddressZero
          ? undefined
          : new Address(deposit.vault),
      revealedAt: BigNumber.from(deposit.revealedAt).toNumber(),
      sweptAt: BigNumber.from(deposit.sweptAt).toNumber(),
      treasuryFee: BigNumber.from(deposit.treasuryFee),
    }
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @see {ChainBridge#activeWalletPublicKey}
   */
  async activeWalletPublicKey(): Promise<string | undefined> {
    const activeWalletPubKeyHash = await this._bridge.activeWalletPubKeyHash()

    if (
      activeWalletPubKeyHash === "0x0000000000000000000000000000000000000000"
    ) {
      // If there is no active wallet currently, return undefined.
      return undefined
    }

    const { ecdsaWalletID } = await this._bridge.wallets(activeWalletPubKeyHash)

    const walletRegistry = await this.walletRegistry()
    const uncompressedPublicKey = await walletRegistry.getWalletPublicKey(
      ecdsaWalletID
    )

    return compressPublicKey(uncompressedPublicKey)
  }

  private async walletRegistry(): Promise<WalletRegistry> {
    const { ecdsaWalletRegistry } = await this._bridge.contractReferences()

    return new WalletRegistry({
      address: ecdsaWalletRegistry,
      signer: this._bridge.signer,
    })
  }
}

/**
 * Implementation of the Ethereum WalletRegistry handle.
 */
class WalletRegistry {
  private _walletRegistry: Contract

  constructor(config: ContractConfig) {
    this._walletRegistry = new Contract(
      config.address || utils.getAddress(WalletRegistryAddress),
      `${JSON.stringify(WalletRegistryABI)}`,
      config.signer
    )
  }

  /**
   * Gets the public key for the given wallet.
   * @param walletID ID of the wallet.
   * @returns Uncompressed wallet public key as an unprefixed (neither 0x nor 04)
   *          hex string.
   */
  async getWalletPublicKey(walletID: string): Promise<string> {
    const publicKey = await this._walletRegistry.getWalletPublicKey(walletID)
    return publicKey.substring(2)
  }
}
