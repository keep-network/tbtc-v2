import { Bridge as ChainBridge, Identifier as ChainIdentifier } from "./chain"
import {
  BigNumber,
  constants,
  Contract as EthersContract,
  Signer,
  utils,
} from "ethers"
import BridgeDeployment from "@keep-network/tbtc-v2/artifacts/Bridge.json"
import WalletRegistryDeployment from "@keep-network/ecdsa/artifacts/WalletRegistry.json"
import { Deposit, DepositRevealedEvent, RevealedDeposit } from "./deposit"
import { Event as EthersEvent } from "ethers"
import { BlockTag as EthersBlockTag } from "@ethersproject/abstract-provider"
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
 * Contract deployment artifact.
 * @see [hardhat-deploy#Deployment](https://github.com/wighawag/hardhat-deploy/blob/0c969e9a27b4eeff9f5ccac7e19721ef2329eed2/types.ts#L358)}
 */
export interface Deployment {
  /**
   * Address of the deployed contract.
   */
  address: string
  /**
   * Contract's ABI.
   */
  abi: any[]
  /**
   * Deployment transaction receipt.
   */
  receipt: {
    /**
     * Number of block in which the contract was deployed.
     */
    blockNumber: number
  }
}

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
   * Optional parameter, if not provided the value will be resolved from the
   * contract artifact.
   */
  address?: string
  /**
   * Signer that will sign all contract transactions.
   */
  signer: Signer
  /**
   * Number of a block in which the contract was deployed.
   * Optional parameter, if not provided the value will be resolved from the
   * contract artifact.
   */
  deployedAtBlockNumber?: number
}

/**
 * Represents an Ethereum event.
 */
export interface Event {
  /**
   * Ethereum block number of the event emission.
   */
  blockNumber: number
  /**
   * Ethereum block hahs of the event emission.
   */
  blockHash: string
  /**
   * Ethereum transaction hash within which the event was emitted.
   */
  transactionHash: string
}

/**
 * Deployed Ethereum contract
 */
class EthereumContract {
  /**
   * Ethers instance of the deployed contract.
   */
  protected readonly _instance: EthersContract
  /**
   * Number of a block within which the contract was deployed. Value is read from
   * the contract deployment artifact. It can be overwritten by setting a
   * {@link ContractConfig.deployedAtBlockNumber} property.
   */
  protected readonly _deployedAtBlockNumber: number

  /**
   * @param config Configuration for contract instance initialization.
   * @param deployment Contract Deployment artifact.
   */
  constructor(config: ContractConfig, deployment: Deployment) {
    this._instance = new EthersContract(
      config.address ?? utils.getAddress(deployment.address),
      `${JSON.stringify(deployment.abi)}`,
      config.signer
    )

    this._deployedAtBlockNumber =
      config.deployedAtBlockNumber ?? deployment.receipt.blockNumber
  }

  /**
   * Query events emitted by the Ethereum contract.
   * @param eventName Name of the event.
   * @param fromBlock Block number from which events should be queried. Optional
   *        parameter, by default block number of the contract deployment is used.
   * @param toBlock Block number to which events should be queried. Optional
   *        parameter, by efault the latest block is used.
   * @param filterArgs Arguments for events filtering.
   * @returns Array of found events.
   */
  async queryEvents(
    eventName: string,
    fromBlock?: EthersBlockTag,
    toBlock?: EthersBlockTag,
    ...filterArgs: Array<any>
  ): Promise<EthersEvent[]> {
    // TODO: Test if we need a workaround for querying events from big range in chunks,
    // see: https://github.com/keep-network/tbtc-monitoring/blob/e169357d7b8c638d4eaf73d52aa8f53ee4aebc1d/src/lib/ethereum-helper.js#L44-L73
    return await this._instance.queryFilter(
      this._instance.filters[eventName](...filterArgs),
      fromBlock ?? this._deployedAtBlockNumber,
      toBlock ?? "latest"
    )
  }
}

/**
 * Implementation of the Ethereum Bridge handle.
 * @see {ChainBridge} for reference.
 */
export class Bridge extends EthereumContract implements ChainBridge {
  constructor(config: ContractConfig) {
    super(config, BridgeDeployment)
  }

  /**
   * Query emitted DepositRevealed events.
   * @param fromBlock Block number from which events should be queried.
   *        {@link queryEvents.fromBlock}
   * @param toBlock Block number to which events should be queried.
   *        {@link queryEvents.toBlock}
   * @param filterArgs Arguments for events filtering. {@link queryEvents.filterArgs}
   * @returns Found DepositRevealed events.
   * @see EthereumContract.queryEvents
   */
  async queryDepositRevealedEvents(
    fromBlock?: EthersBlockTag,
    toBlock?: EthersBlockTag,
    ...filterArgs: Array<any>
  ): Promise<DepositRevealedEvent[]> {
    const events: EthersEvent[] = await this.queryEvents(
      "DepositRevealed",
      fromBlock,
      toBlock,
      filterArgs
    )

    return events.map<DepositRevealedEvent>((event) => {
      return {
        blockNumber: BigNumber.from(event.blockNumber).toNumber(),
        blockHash: event.blockHash,
        transactionHash: event.transactionHash,
        fundingTxHash: TransactionHash.from(event.args!.fundingTxHash),
        fundingOutputIndex: BigNumber.from(
          event.args!.fundingOutputIndex
        ).toNumber(),
        depositor: new Address(event.args!.depositor),
        amount: BigNumber.from(event.args!.amount),
        blindingFactor: event.args!.blindingFactor,
        walletPubKeyHash: event.args!.walletPubKeyHash,
        refundPubKeyHash: event.args!.refundPubKeyHash,
        refundLocktime: event.args!.refundLocktime,
        vault:
          event.args!.vault === constants.AddressZero
            ? undefined
            : new Address(event.args!.vault),
      }
    })
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

    const request = await this._instance.pendingRedemptions(redemptionKey)

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

    const request = await this._instance.timedOutRedemptions(redemptionKey)

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

    await this._instance.revealDeposit(depositTxParam, revealParam)
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
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const vaultParam = vault
      ? `0x${vault.identifierHex}`
      : constants.AddressZero

    await this._instance.submitDepositSweepProof(
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
      await this._instance.txProofDifficultyFactor()
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
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
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

    await this._instance.requestRedemption(
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
      txHash: mainUtxo.transactionHash.reverse().toPrefixedString(),
      txOutputIndex: mainUtxo.outputIndex,
      txOutputValue: mainUtxo.value,
    }

    const walletPublicKeyHash = `0x${computeHash160(walletPublicKey)}`

    await this._instance.submitRedemptionProof(
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

    const deposit = await this._instance.deposits(depositKey)

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
    const prefixedReversedDepositTxHash = depositTxHash
      .reverse()
      .toPrefixedString()

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
    const activeWalletPubKeyHash = await this._instance.activeWalletPubKeyHash()

    if (
      activeWalletPubKeyHash === "0x0000000000000000000000000000000000000000"
    ) {
      // If there is no active wallet currently, return undefined.
      return undefined
    }

    const { ecdsaWalletID } = await this._instance.wallets(
      activeWalletPubKeyHash
    )

    const walletRegistry = await this.walletRegistry()
    const uncompressedPublicKey = await walletRegistry.getWalletPublicKey(
      ecdsaWalletID
    )

    return compressPublicKey(uncompressedPublicKey)
  }

  private async walletRegistry(): Promise<WalletRegistry> {
    const { ecdsaWalletRegistry } = await this._instance.contractReferences()

    return new WalletRegistry({
      address: ecdsaWalletRegistry,
      signer: this._instance.signer,
    })
  }
}

/**
 * Implementation of the Ethereum WalletRegistry handle.
 */
class WalletRegistry extends EthereumContract {
  constructor(config: ContractConfig) {
    super(config, WalletRegistryDeployment)
  }

  /**
   * Gets the public key for the given wallet.
   * @param walletID ID of the wallet.
   * @returns Uncompressed wallet public key as an unprefixed (neither 0x nor 04)
   *          hex string.
   */
  async getWalletPublicKey(walletID: string): Promise<string> {
    const publicKey = await this._instance.getWalletPublicKey(walletID)
    return publicKey.substring(2)
  }
}
